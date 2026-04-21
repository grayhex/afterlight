import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { User, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET || 'secret';

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

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

  async getUser(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const tokenHash = this.hashToken(token);
    await this.resetTokenRepo.deleteMany({
      where: { userId: user.id },
    });
    await this.resetTokenRepo.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
    const vault = await this.prisma.vault.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });
    if (vault) {
      await this.notifications.enqueueEmail(vault.id, email, {
        subject: 'Afterlight: восстановление пароля',
        text: `Токен для сброса пароля: ${token}`,
      });
      await this.notifications.flushEmailQueue();
    }
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
