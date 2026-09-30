import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service.js';
import { OrchestratorController } from './orchestrator.controller.js';
import { OrchestratorProcessor } from './orchestrator.processor.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [NotificationsModule, PrismaModule, AuthModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, OrchestratorProcessor],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
