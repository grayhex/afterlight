import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { VerifiedEmailGuard } from './auth/guards/verified-email.guard.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { VaultsModule } from './vaults/vaults.module.js';
import { VerifiersModule } from './verifiers/verifiers.module.js';
import { VerificationEventsModule } from './verification-events/verification-events.module.js';
import { BlocksModule } from './blocks/blocks.module.js';
import { RecipientsModule } from './recipients/recipients.module.js';
import { PublicLinksModule } from './public-links/public-links.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OrchestratorModule } from './orchestrator/orchestrator.module.js';
import { HeartbeatsModule } from './heartbeats/heartbeats.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { PlansModule } from './plans/plans.module.js';
import { SubscriptionsModule } from './subscriptions/subscriptions.module.js';
import { AuditLogsModule } from './audit-logs/audit-logs.module.js';
import { RecoverySharesModule } from './recovery-shares/recovery-shares.module.js';
import { AuditModule } from './audit/audit.module.js';
import { VaultAccessModule } from './vault-access/vault-access.module.js';
import { ClockModule } from './clock/clock.module.js';
import { AuthGuard } from './auth/guards/auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { RateLimitModule } from './rate-limit/rate-limit.module.js';
import { RateLimitGuard } from './rate-limit/rate-limit.guard.js';
import { OriginCheckMiddleware } from './common/origin-check.middleware.js';

@Module({
imports: [
  PrismaModule,
  ClockModule,
  RateLimitModule,
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
  { provide: APP_GUARD, useClass: RateLimitGuard },
  { provide: APP_GUARD, useClass: RolesGuard },
  { provide: APP_GUARD, useClass: VerifiedEmailGuard },
],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(OriginCheckMiddleware).forRoutes('*');
  }
}
