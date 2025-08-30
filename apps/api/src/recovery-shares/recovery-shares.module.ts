import { Module } from '@nestjs/common';
import { RecoverySharesService } from './recovery-shares.service';
import { RecoverySharesController } from './recovery-shares.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [RecoverySharesController],
  providers: [RecoverySharesService],
})
export class RecoverySharesModule {}
