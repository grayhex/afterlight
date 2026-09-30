import { Module } from '@nestjs/common';
import { VerifiersService } from './verifiers.service.js';
import { VerifiersController } from './verifiers.controller.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [NotificationsModule, AuthModule],
  controllers: [VerifiersController],
  providers: [VerifiersService],
  exports: [VerifiersService],
})
export class VerifiersModule {}
