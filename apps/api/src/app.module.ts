import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { AuditModule } from './audit/audit.module';
import { VaultAccessModule } from './vault-access/vault-access.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';

@Module({
imports: [
  PrismaModule,
  VaultAccessModule,
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
  AuditModule,
],
// Guards живут в модуле приложения, а не в bootstrap: тесты и production проходят через одну и ту же авторизацию.
providers: [
  { provide: APP_GUARD, useClass: AuthGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
],
})
export class AppModule {}
