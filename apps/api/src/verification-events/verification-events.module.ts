import { Module } from '@nestjs/common';
import { VerificationEventsService } from './verification-events.service';
import { VerificationEventsController } from './verification-events.controller';

@Module({
  controllers: [VerificationEventsController],
  providers: [VerificationEventsService],
})
export class VerificationEventsModule {}
