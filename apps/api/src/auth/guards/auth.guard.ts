import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const openPaths = ['/auth/login', '/auth/register', '/auth/logout', '/healthz', '/readyz'];
    if (openPaths.includes(req.path)) {
      return true;
    }
    const authHeader = req.headers['authorization'] || '';
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    const cookies = (req.headers['cookie'] || '')
      .split(';')
      .map((c: string) => c.trim().split('='))
      .reduce((acc: Record<string, string>, [k, v]) => {
        if (k && v) acc[k] = decodeURIComponent(v);
        return acc;
      }, {} as Record<string, string>);
    const token = cookies['token'] || bearer;
    if (!token) {
      throw new UnauthorizedException();
    }
    const payload = this.auth.verify(token);
    if (!payload) {
      throw new UnauthorizedException();
    }
    req.user = payload;
    return true;
  }
}
