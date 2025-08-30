import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ApiErrorResponses } from '../common/api-error-responses.decorator';

@ApiTags('auth')
@ApiErrorResponses()
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body('userId') userId: string) {
    return { access_token: this.auth.sign(userId) };
  }
}
