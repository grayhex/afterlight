import { Module } from '@nestjs/common';
import { VerificationEventsController } from './verification-events.controller';
import { VerificationEventsService } from './verification-events.service';

@Module({
  controllers: [VerificationEventsController],
  providers: [VerificationEventsService],
})
export class VerificationEventsModule {}