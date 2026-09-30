import { Global, Module } from '@nestjs/common';
import { VaultAccessService } from './vault-access.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [VaultAccessService],
  exports: [VaultAccessService],
})
export class VaultAccessModule {}
