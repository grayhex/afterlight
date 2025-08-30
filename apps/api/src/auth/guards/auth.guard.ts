import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const openPaths = ['/auth/login', '/healthz', '/readyz'];
    if (openPaths.includes(req.path)) {
      return true;
    }
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
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
