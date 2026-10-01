import { Module } from '@nestjs/common';
import { HeartbeatsService } from './heartbeats.service.js';
import { HeartbeatsController } from './heartbeats.controller.js';
import { OrchestratorModule } from '../orchestrator/orchestrator.module.js';

@Module({
  imports: [OrchestratorModule],
  controllers: [HeartbeatsController],
  providers: [HeartbeatsService],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}
