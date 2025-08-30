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
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PlansModule } from './plans/plans.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuditLogsModule } from './audit-logs/audit-logs.module';
import { RecoverySharesModule } from './recovery-shares/recovery-shares.module';

@Module({
imports: [
  PrismaModule,
  AuthModule,
  VaultsModule,
  VerifiersModule,
  VerificationEventsModule,
  BlocksModule,
  RecipientsModule,
  PublicLinksModule,
  HeartbeatsModule,
  NotificationsModule,
  OrchestratorModule,
  HealthModule,
  UsersModule,
  PlansModule,
  SubscriptionsModule,
  AuditLogsModule,
  RecoverySharesModule,
],
})
export class AppModule {}
