import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { VaultsModule } from './vaults/vaults.module';
import { VerifiersModule } from './verifiers/verifiers.module';
import { VerificationEventsModule } from './verification-events/verification-events.module';
import { BlocksModule } from './blocks/blocks.module';

@Module({
  imports: [
    PrismaModule,
    VaultsModule,
    VerifiersModule,
    VerificationEventsModule,
    BlocksModule,
  ],
})
export class AppModule {}
