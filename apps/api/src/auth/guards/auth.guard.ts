import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const token = extractToken(req);
    if (!token) {
      throw new UnauthorizedException();
    }
    const payload = this.auth.verify(token);
    if (!payload || typeof payload.sub !== 'string' || !(await this.auth.isSessionCurrent(payload))) {
      throw new UnauthorizedException();
    }
    req.user = payload;
    return true;
  }
}

/** Токен сессии: cookie `token` или заголовок `Authorization: Bearer`. */
export function extractToken(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const authHeader = String(req.headers['authorization'] || '');
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const cookies = String(req.headers['cookie'] || '')
    .split(';')
    .map((c) => c.trim().split('='))
    .reduce((acc, [k, v]) => {
      if (k && v) acc[k] = decodeURIComponent(v);
      return acc;
    }, {} as Record<string, string>);
  return cookies['token'] || bearer;
}
