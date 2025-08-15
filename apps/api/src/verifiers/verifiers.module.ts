import { Module } from '@nestjs/common';
import { VerifiersService } from './verifiers.service';
import { VerifiersController } from './verifiers.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  controllers: [VerifiersController],
  providers: [VerifiersService],
  exports: [VerifiersService],
})
export class VerifiersModule {}
