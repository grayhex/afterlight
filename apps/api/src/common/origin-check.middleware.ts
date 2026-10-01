import { ForbiddenException, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function trustedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

/**
 * Защита cookie-сессии от CSRF поверх SameSite=Lax: запрос, меняющий состояние, с заголовком Origin допускается
 * только от доверенного origin (CORS_ALLOWED_ORIGINS — тот же список, что у CORS). Браузер всегда присылает Origin
 * на такие запросы; клиенты без Origin (curl, серверные вызовы, тесты) — не браузерные, подделать через чужую
 * страницу их нельзя, поэтому отсутствие заголовка допускается. Origin `null` (песочницы, скрытые контексты) отклоняется.
 */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    const origin = req.headers['origin'];
    if (SAFE_METHODS.has(req.method) || typeof origin !== 'string') return next();
    if (!trustedOrigins().includes(origin.replace(/\/+$/, ''))) {
      throw new ForbiddenException('Origin is not allowed');
    }
    next();
  }
}
