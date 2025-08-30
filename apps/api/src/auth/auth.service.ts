import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly secret = process.env.JWT_SECRET || 'secret';

  sign(userId: string): string {
    return jwt.sign({ sub: userId }, this.secret, { expiresIn: '1h' });
  }

  verify(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (e) {
      return null;
    }
  }
}
