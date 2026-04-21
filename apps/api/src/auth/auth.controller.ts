import {
  Body,
  Controller,
  Post,
  UnauthorizedException,
  Res,
  Get,
  Req,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { Response, Request } from 'express';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private readonly tokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 1000,
    path: '/',
  };

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(
      dto.name,
      dto.email,
      dto.phone,
      dto.password,
    );
    const { id, email, role } = user;
    return { id, email, role };
  }

  @Post('login')
  async login(
    @Body() { email, password }: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.auth.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException();
    }
    const token = this.auth.sign(user.id);
    res.cookie('token', token, this.tokenCookieOptions);
    const { id, email: userEmail, role } = user;
    return { id, email: userEmail, role };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', {
      path: this.tokenCookieOptions.path,
      sameSite: this.tokenCookieOptions.sameSite,
      secure: this.tokenCookieOptions.secure,
      httpOnly: this.tokenCookieOptions.httpOnly,
    });
    return {};
  }

  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    return {};
  }

  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    const ok = await this.auth.resetPassword(dto.token, dto.password);
    if (!ok) {
      throw new UnauthorizedException();
    }
    return {};
  }

  @Get('me')
  async me(@Req() req: Request) {
    const userId = (req as any).user?.sub;
    if (!userId) throw new UnauthorizedException();
    const user = await this.auth.getUser(userId);
    if (!user) throw new UnauthorizedException();
    return { id: user.id, email: user.email, role: user.role };
  }
}
