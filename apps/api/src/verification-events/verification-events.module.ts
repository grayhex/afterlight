import { Module } from '@nestjs/common';
import { VerificationEventsService } from './verification-events.service.js';
import { VerificationEventsController } from './verification-events.controller.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';

@Module({
  imports: [OrchestratorModule],
  controllers: [VerificationEventsController],
  providers: [VerificationEventsService],
})
export class VerificationEventsModule {}
