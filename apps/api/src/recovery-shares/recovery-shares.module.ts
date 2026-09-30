import { Module } from '@nestjs/common';
import { RecoverySharesService } from './recovery-shares.service.js';
import { RecoverySharesController } from './recovery-shares.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [RecoverySharesController],
  providers: [RecoverySharesService],
})
export class RecoverySharesModule {}
