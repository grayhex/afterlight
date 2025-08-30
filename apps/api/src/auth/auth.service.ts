import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../prisma/prisma.service';
import { verifyPassword } from './password';

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET || 'secret';

  constructor(private readonly prisma: PrismaService) {}

  sign(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { expiresIn: '1h' });
  }

  async validateUser(email: string, password: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) return null;
    return (await verifyPassword(password, user.passwordHash)) ? user.id : null;
  }

  verify(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (e) {
      return null;
    }
  }
}
