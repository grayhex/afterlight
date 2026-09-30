import { Module } from '@nestjs/common';
import { VaultsService } from './vaults.service.js';
import { VaultsController } from './vaults.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [VaultsController],
  providers: [VaultsService],
  exports: [VaultsService],
})
export class VaultsModule {}
