import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, RateLimitMeta } from './rate-limit.decorator.js';
import { RateLimitService, TooManyRequestsException, clientIp } from './rate-limit.service.js';

/**
 * Работает после AuthGuard (порядок APP_GUARD в AppModule): для `by: 'user'` пользователь уже проверен.
 * Маршруты без метки не затрагиваются.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private reflector: Reflector, private limiter: RateLimitService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meta = this.reflector.getAllAndOverride<RateLimitMeta | undefined>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);
    if (!meta) return true;
    const http = context.switchToHttp();
    const req = http.getRequest();
    const subject = meta.by === 'user' ? req.user?.sub : clientIp(req);
    if (typeof subject !== 'string') return true; // без субъекта лимит не к чему привязать; вход проверит AuthGuard
    const res = await this.limiter.hit(meta.policy, subject);
    if (!res.allowed) {
      http.getResponse().setHeader('Retry-After', String(res.retryAfterSec));
      throw new TooManyRequestsException(res.retryAfterSec);
    }
    return true;
  }
}
