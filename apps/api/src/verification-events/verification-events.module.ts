import { Module } from '@nestjs/common';
import { VerificationEventsService } from './verification-events.service';
import { VerificationEventsController } from './verification-events.controller';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';

@Module({
  imports: [OrchestratorModule],
  controllers: [VerificationEventsController],
  providers: [VerificationEventsService],
})
export class VerificationEventsModule {}
