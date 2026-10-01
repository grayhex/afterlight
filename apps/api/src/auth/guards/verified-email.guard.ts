import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service.js';
import { REQUIRE_VERIFIED_EMAIL_KEY } from '../decorators/require-verified-email.decorator.js';

/**
 * Для помеченных маршрутов проверяет по базе, что адрес пользователя подтверждён. Работает после AuthGuard
 * (порядок APP_GUARD в AppModule), поэтому `req.user` уже проверен; состояние берём из БД, а не из токена,
 * чтобы подтверждение и его отсутствие действовали сразу.
 */
@Injectable()
export class VerifiedEmailGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, [context.getHandler(), context.getClass()]);
    if (!required) return true;
    const userId = context.switchToHttp().getRequest().user?.sub;
    if (typeof userId !== 'string') throw new UnauthorizedException();
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { emailVerifiedAt: true } });
    if (!user) throw new UnauthorizedException();
    if (!user.emailVerifiedAt) throw new ForbiddenException('Email address is not verified');
    return true;
  }
}
