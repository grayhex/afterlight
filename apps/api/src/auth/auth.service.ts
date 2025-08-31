import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { User, UserRole } from '@prisma/client';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET || 'secret';
  private readonly resetTokens = new Map<
    string,
    { userId: string; expires: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  sign(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { expiresIn: '1h' });
  }

  async register(
    email: string,
    password: string,
    role: UserRole = UserRole.Owner,
  ): Promise<User> {
    const passwordHash = await hashPassword(password);
    return this.prisma.user.create({
      data: { email, passwordHash, role },
    });
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
    const token = randomBytes(16).toString('hex');
    this.resetTokens.set(token, {
      userId: user.id,
      expires: Date.now() + 60 * 60 * 1000,
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
    const entry = this.resetTokens.get(token);
    if (!entry || entry.expires < Date.now()) return false;
    const passwordHash = await hashPassword(password);
    await this.prisma.user.update({
      where: { id: entry.userId },
      data: { passwordHash },
    });
    this.resetTokens.delete(token);
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
