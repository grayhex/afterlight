import { ConflictException, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { Prisma, User, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ClockService } from '../clock/clock.service.js';
import { OrchestratorService } from '../orchestrator/orchestrator.service.js';
import { normalizeEmail } from '../common/email.js';
import { hashInvitationToken } from '../verifiers/verifiers.service.js';

/** Защита от почтового спама через публичный /auth/forgot-password: пауза между письмами и потолок в час на адрес. */
const RESET_COOLDOWN_MS = 60 * 1000;
const RESET_HOURLY_CAP = 5;
/** То же для писем подтверждения адреса; ссылка живёт сутки */
const VERIFY_COOLDOWN_MS = 60 * 1000;
const VERIFY_HOURLY_CAP = 5;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly secret = this.getJwtSecret();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly clock: ClockService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error('JWT_SECRET is required');
    }

    return secret;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private get resetTokenRepo() {
    return (this.prisma as any).passwordResetToken as {
      deleteMany(args: any): Promise<any>;
      create(args: any): Promise<any>;
      findFirst(args: any): Promise<any>;
      delete(args: any): Promise<any>;
    };
  }

  sign(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { expiresIn: '1h' });
  }

  /**
   * Регистрация. Адрес нормализуется и подтверждается письмом (ссылка живёт сутки). Если передан токен приглашения,
   * выписанный на этот же адрес, владение почтой уже доказано получением письма — адрес подтверждается сразу.
   * Токен приглашения при этом не расходуется: приглашение принимается отдельным действием после входа.
   */
  async register(
    name: string,
    email: string,
    phone: string,
    password: string,
    invitationToken?: string,
  ): Promise<User> {
    const normalized = normalizeEmail(email);
    const passwordHash = await hashPassword(password);
    const now = this.clock.now();
    let provenByInvitation = false;
    if (invitationToken) {
      const invitation = await this.prisma.vaultUserInvitation.findFirst({
        where: { token: hashInvitationToken(invitationToken), email: normalized, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        select: { id: true },
      });
      provenByInvitation = !!invitation; // чужой или недействительный токен молча игнорируется: обычная регистрация
    }
    const token = randomBytes(32).toString('base64url');
    let user: User;
    try {
      user = await this.prisma.$transaction(async (tx) => {
        const created = await tx.user.create({
          data: { name, email: normalized, phone, passwordHash, role: UserRole.Owner, emailVerifiedAt: provenByInvitation ? now : null },
        });
        if (!provenByInvitation) {
          const expiresAt = new Date(now.getTime() + VERIFY_TTL_MS);
          await tx.emailVerificationToken.create({ data: { userId: created.id, tokenHash: this.hashToken(token), expiresAt, createdAt: now } });
          await this.notifications.sendEmailVerification(normalized, token, created.id, expiresAt, tx);
        }
        return created;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('Email is already registered');
      }
      throw e;
    }
    if (!provenByInvitation) this.notifications.dispatchSoon();
    return user;
  }

  /** Подтверждение адреса по одноразовому токену из письма. false — токен недействителен, просрочен или уже использован. */
  async verifyEmail(token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const now = this.clock.now();
    return this.prisma.$transaction(async (tx) => {
      const entry = await tx.emailVerificationToken.findFirst({ where: { tokenHash, expiresAt: { gt: now } } });
      if (!entry) return false;
      // одноразовость при параллельных запросах: токен «забирает» только тот, кому удалось его удалить
      const taken = await tx.emailVerificationToken.deleteMany({ where: { id: entry.id } });
      if (taken.count !== 1) return false;
      await tx.user.updateMany({ where: { id: entry.userId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
      await tx.emailVerificationToken.deleteMany({ where: { userId: entry.userId } });
      await this.notifications.cancelQueued('email_verification', entry.userId, 'token consumed', tx);
      return true;
    });
  }

  /** Повторная отправка письма подтверждения вошедшему пользователю; для уже подтверждённого — без действия. */
  async resendVerification(userId: string): Promise<void> {
    const now = this.clock.now();
    const token = randomBytes(32).toString('base64url');
    const queued: boolean = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "user" WHERE id = ${userId}::uuid FOR UPDATE`);
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user || user.emailVerifiedAt) return false;
      const recent = await tx.emailVerificationToken.findFirst({
        where: { userId, createdAt: { gt: new Date(now.getTime() - VERIFY_COOLDOWN_MS) } },
        select: { id: true },
      });
      if (recent) return false;
      const lastHour = await tx.notification.count({
        where: { kind: 'email_verification', supersedeKey: userId, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
      });
      if (lastHour >= VERIFY_HOURLY_CAP) return false;
      const expiresAt = new Date(now.getTime() + VERIFY_TTL_MS);
      await tx.emailVerificationToken.deleteMany({ where: { userId } });
      await tx.emailVerificationToken.create({ data: { userId, tokenHash: this.hashToken(token), expiresAt, createdAt: now } });
      await this.notifications.sendEmailVerification(user.email, token, userId, expiresAt, tx);
      return true;
    });
    if (queued) this.notifications.dispatchSoon();
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
    if (!user || !user.passwordHash) return null;
    return (await verifyPassword(password, user.passwordHash)) ? user : null;
  }

  /**
   * Успешный вход: фиксируем время и считаем это активностью владельца (D5): активные процессы по его сейфам отменяются.
   */
  async recordLogin(userId: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { lastLoginAt: this.clock.now() } });
    await this.orchestrator.cancelOnOwnerActivity(userId, 'login');
  }

  async getUser(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async forgotPassword(rawEmail: string) {
    const email = normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const now = this.clock.now();
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const tokenHash = this.hashToken(token);
    // Токен и намерение отправить письмо фиксируются атомарно: нет токена без письма и письма без токена
    const queued: boolean = await (this.prisma as any).$transaction(async (tx: any) => {
      // Параллельные запросы одного пользователя выстраиваются в очередь: каждый видит результат предыдущего,
      // поэтому остаётся ровно один действующий токен и одно неотправленное письмо
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "user" WHERE id = ${user.id}::uuid FOR UPDATE`);
      // Анти-спам: слишком частые запросы молча не создают новое письмо (ответ API одинаков, существование адреса не раскрывается)
      const recent = await tx.passwordResetToken.findFirst({
        where: { userId: user.id, createdAt: { gt: new Date(now.getTime() - RESET_COOLDOWN_MS) } },
        select: { id: true },
      });
      if (recent) return false;
      const lastHour = await tx.notification.count({
        where: { kind: 'password_reset', supersedeKey: user.id, createdAt: { gt: new Date(now.getTime() - 60 * 60 * 1000) } },
      });
      if (lastHour >= RESET_HOURLY_CAP) return false;
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt, createdAt: now } });
      // Восстановление аккаунта не зависит от наличия сейфа: системное письмо не привязано к vault
      await this.notifications.sendPasswordReset(email, token, user.id, expiresAt, tx);
      return true;
    });
    if (queued) this.notifications.dispatchSoon();
  }

  async resetPassword(token: string, password: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const entry = await this.resetTokenRepo.findFirst({
      where: {
        tokenHash,
        expiresAt: {
          gt: new Date(),
        },
      },
    });
    if (!entry) return false;
    const passwordHash = await hashPassword(password);
    await (this.prisma as any).$transaction(async (tx: any) => {
      await tx.user.update({
        where: { id: entry.userId },
        data: { passwordHash },
      });
      await tx.passwordResetToken.delete({ where: { id: entry.id } });
      // Токен израсходован: неотправленное (или ожидающее повтора) письмо с ним больше не нужно
      await this.notifications.cancelQueued('password_reset', entry.userId, 'token consumed', tx);
    });
    return true;
  }

  verify(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (e) {
      return null;
    }
  }
}
