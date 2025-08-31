import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { User, UserRole } from '@prisma/client';

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET || 'secret';

  constructor(private readonly prisma: PrismaService) {}

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

  verify(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (e) {
      return null;
    }
  }
}
