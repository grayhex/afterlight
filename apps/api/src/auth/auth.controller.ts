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
import { Response, Request } from 'express';
import { UserRole } from '@prisma/client';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const user = await this.auth.register(dto.email, dto.password, dto.role);
    return { id: user.id, email: user.email, role: user.role };
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
    res.cookie('token', token, { httpOnly: true });
    if (user.role === UserRole.Admin) {
      const basic = Buffer.from(`${email}:${password}`).toString('base64');
      res.cookie('auth', basic, { httpOnly: true });
    } else {
      res.clearCookie('auth');
    }
    return { id: user.id, email: user.email, role: user.role };
  }

  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token');
    res.clearCookie('auth');
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
