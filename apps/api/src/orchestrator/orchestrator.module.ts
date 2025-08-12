import { Module } from '@nestjs/common';
import { OrchestratorService } from './orchestrator.service';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorProcessor } from './orchestrator.processor';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [NotificationsModule, PrismaModule],
  controllers: [OrchestratorController],
  providers: [OrchestratorService, OrchestratorProcessor],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
