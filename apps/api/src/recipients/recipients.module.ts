import { Module } from '@nestjs/common';
import { RecipientsService } from './recipients.service.js';
import { RecipientsController } from './recipients.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [RecipientsController],
  providers: [RecipientsService],
  exports: [RecipientsService],
})
export class RecipientsModule {}
