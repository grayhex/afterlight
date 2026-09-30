import { Global, Module } from '@nestjs/common';
import { VaultAccessService } from './vault-access.service';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [VaultAccessService],
  exports: [VaultAccessService],
})
export class VaultAccessModule {}
