import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Temporary helper until real Auth is wired.
 * Reads user id from `x-debug-user` header or env DEFAULT_DEBUG_USER.
 */
export const CurrentUserId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const header = (req.headers['x-debug-user'] || '').toString();
    const fallback = process.env.DEFAULT_DEBUG_USER || null;
    return header || fallback;
  },
);
