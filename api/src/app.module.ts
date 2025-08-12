import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module';
import { VaultsModule } from './vaults/vaults.module';
import { VerifiersModule } from './verifiers/verifiers.module';
import { VerificationEventsModule } from './verification-events/verification-events.module';

@Module({
  imports: [HealthModule, VaultsModule, VerifiersModule, VerificationEventsModule],
})
export class AppModule {}