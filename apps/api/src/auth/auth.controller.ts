import { Body, Controller, Post, UnauthorizedException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';
import { LoginDto } from './dto/login.dto';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  async login(@Body() { email, password }: LoginDto) {
    const userId = await this.auth.validateUser(email, password);
    if (!userId) {
      throw new UnauthorizedException();
    }
    return { access_token: this.auth.sign(userId) };
  }
}
