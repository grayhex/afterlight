import { applyDecorators, SetMetadata } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { ErrorDto } from '../common/error.dto.js';
import type { PolicyName } from './rate-limit.service.js';

export const RATE_LIMIT_KEY = 'rateLimit';
export interface RateLimitMeta {
  policy: PolicyName;
  /** ip — клиент по IP (публичные маршруты); user — вошедший пользователь */
  by: 'ip' | 'user';
}

/** Ограничивает частоту обращений к маршруту по заданной политике (лимиты — rate-limit.service.ts, env RATE_LIMIT_*). */
export const RateLimit = (policy: PolicyName, by: 'ip' | 'user' = 'ip') =>
  applyDecorators(
    SetMetadata(RATE_LIMIT_KEY, { policy, by } satisfies RateLimitMeta),
    ApiTooManyRequestsResponse({ type: ErrorDto, description: 'Превышена частота запросов; заголовок Retry-After — через сколько секунд повторить' }),
  );
