import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { VaultsModule } from './vaults/vaults.module';
import { VerifiersModule } from './verifiers/verifiers.module';
import { VerificationEventsModule } from './verification-events/verification-events.module';
import { BlocksModule } from './blocks/blocks.module';
import { RecipientsModule } from './recipients/recipients.module';
import { PublicLinksModule } from './public-links/public-links.module';
import { NotificationsModule } from './notifications/notifications.module';
import { OrchestratorModule } from './orchestrator/orchestrator.module';
import { HeartbeatsModule } from './heartbeats/heartbeats.module';

@Module({
imports: [
  PrismaModule,
  VaultsModule,
  VerifiersModule,
  VerificationEventsModule,
  BlocksModule,
  RecipientsModule,
  PublicLinksModule,
  HeartbeatsModule,
  NotificationsModule,
  OrchestratorModule,
],
})
export class AppModule {}
