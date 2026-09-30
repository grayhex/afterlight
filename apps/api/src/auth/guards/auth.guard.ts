import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from '../auth.service.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers['authorization'] || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookies = (req.headers['cookie'] || '')
      .split(';')
      .map((c: string) => c.trim().split('='))
      .reduce((acc: Record<string, string>, [k, v]: [string, string]) => {
        if (k && v) acc[k] = decodeURIComponent(v);
        return acc;
      }, {} as Record<string, string>);
    const token = cookies['token'] || bearer;
    if (!token) {
      throw new UnauthorizedException();
    }
    const payload = this.auth.verify(token);
    if (!payload || typeof payload.sub !== 'string') {
      throw new UnauthorizedException();
    }
    req.user = payload;
    return true;
  }
}
