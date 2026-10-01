import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  Res,
  Get,
  Req,
  GoneException,
} from '@nestjs/common';
import { ApiCreatedResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { AuthUserDto, EmptyResponseDto } from './dto/auth-responses.dto.js';
import { ErrorDto } from '../common/error.dto.js';
import { AuthService } from './auth.service.js';
import { ApiErrorResponses } from '../common/api-error-responses.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { Response, Request } from 'express';
import { Public } from './decorators/public.decorator.js';
import { extractToken } from './guards/auth.guard.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { RateLimitService, TooManyRequestsException, clientIp, type PolicyName } from '../rate-limit/rate-limit.service.js';
import { normalizeEmail } from '../common/email.js';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly limiter: RateLimitService) {}

  private readonly tokenCookieOptions = {
    httpOnly: true,
    // В production cookie только по HTTPS. Для стенда в LAN по http задайте COOKIE_SECURE=false.
    secure: process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 1000,
    path: '/',
  };

  @Public()
  @RateLimit('register_ip')
  @ApiCreatedResponse({ type: AuthUserDto })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(
      dto.name,
      dto.email,
      dto.phone,
      dto.password,
      dto.invitation_token,
    );
    return { id: user.id, email: user.email, role: user.role, email_verified: !!user.emailVerifiedAt };
  }

  @Public()
  @Post('login')
  @ApiCreatedResponse({ type: AuthUserDto })
  @ApiTooManyRequestsResponse({ type: ErrorDto, description: 'Слишком много неудачных попыток входа; Retry-After — через сколько секунд повторить' })
  async login(
    @Body() { email, password }: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Лимиты неудач: по IP, по паре «аккаунт + IP» и по аккаунту (высокий порог против распределённого подбора).
    // Счётчик ведётся по введённому адресу, существует он или нет: ответ 429 не раскрывает наличие аккаунта.
    const ip = clientIp(req);
    const account = normalizeEmail(email);
    const counters: Array<[PolicyName, string]> = [
      ['login_fail_ip', ip],
      ['login_fail_account_ip', `${account}|${ip}`],
      ['login_fail_account', account],
    ];
    // Допуск и резерв — одной атомарной операцией ДО проверки пароля: параллельная пачка попыток не может прочитать один и тот
    // же «ещё не превышенный» счётчик. При отказе любого лимита откатываются все резервы попытки, при успешном входе — тоже;
    // неудачный вход оставляет резерв израсходованным.
    const admission = await this.limiter.reserve(counters);
    if (!admission.allowed) {
      res.setHeader('Retry-After', String(admission.retryAfterSec));
      throw new TooManyRequestsException(admission.retryAfterSec);
    }
    const user = await this.auth.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    // правильный пароль возвращает резерв и снимает счётчик пары «аккаунт + IP»: опечатки законного пользователя не копятся
    await this.limiter.releaseAll(admission.reservations);
    await this.limiter.reset('login_fail_account_ip', `${account}|${ip}`);
    await this.auth.recordLogin(user.id);
    const token = this.auth.sign(user.id, user.sessionVersion);
    res.cookie('token', token, this.tokenCookieOptions);
    return { id: user.id, email: user.email, role: user.role, email_verified: !!user.emailVerifiedAt };
  }

  @Public()
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    // выход отзывает токены на сервере (все устройства), а не только очищает cookie
    const token = extractToken(req);
    const payload = token ? this.auth.verify(token) : null;
    if (payload && typeof payload.sub === 'string' && (await this.auth.isSessionCurrent(payload))) {
      await this.auth.revokeSessions(payload.sub);
    }
    res.clearCookie('token', {
      path: this.tokenCookieOptions.path,
      sameSite: this.tokenCookieOptions.sameSite,
      secure: this.tokenCookieOptions.secure,
      httpOnly: this.tokenCookieOptions.httpOnly,
    });
    return {};
  }

  @Public()
  @RateLimit('forgot_ip')
  @ApiCreatedResponse({ type: EmptyResponseDto })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return {};
  }

  @Public()
  @RateLimit('reset_ip')
  @ApiCreatedResponse({ type: EmptyResponseDto })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const ok = await this.auth.resetPassword(dto.token, dto.password);
    if (!ok) {
      throw new UnauthorizedException();
    }
    return {};
  }

  @Public()
  @RateLimit('verify_ip')
  @ApiCreatedResponse({ type: EmptyResponseDto })
  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    if (!(await this.auth.verifyEmail(dto.token))) {
      throw new GoneException('The link is invalid, expired or already used');
    }
    return {};
  }

  @RateLimit('resend_user', 'user')
  @ApiCreatedResponse({ type: EmptyResponseDto })
  @Post('resend-verification')
  async resendVerification(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException();
    await this.auth.resendVerification(userId);
    return {};
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.getUser(userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role, email_verified: !!user.emailVerifiedAt };
  }
}
