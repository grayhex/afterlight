import { Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { hashPassword, verifyPassword } from './password.js';
import { Prisma, User, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service.js';
import { ClockService } from '../clock/clock.service.js';
import { OrchestratorService } from '../orchestrator/orchestrator.service.js';

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

  async register(
    name: string,
    email: string,
    phone: string,
    password?: string,
  ): Promise<User> {
    const data: any = { name, email, phone, role: UserRole.Owner };
    if (password) {
      data.passwordHash = await hashPassword(password);
    }
    return this.prisma.user.create({ data });
  }

  async validateUser(email: string, password: string): Promise<User | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
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

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const tokenHash = this.hashToken(token);
    // Токен и намерение отправить письмо фиксируются атомарно: нет токена без письма и письма без токена
    await (this.prisma as any).$transaction(async (tx: any) => {
      // Параллельные запросы одного пользователя выстраиваются в очередь: каждый видит результат предыдущего,
      // поэтому остаётся ровно один действующий токен и одно неотправленное письмо
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "user" WHERE id = ${user.id}::uuid FOR UPDATE`);
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt } });
      // Восстановление аккаунта не зависит от наличия сейфа: системное письмо не привязано к vault
      await this.notifications.sendPasswordReset(email, token, user.id, expiresAt, tx);
    });
    this.notifications.dispatchSoon();
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
