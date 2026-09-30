import { Module } from '@nestjs/common';
import { HeartbeatsService } from './heartbeats.service.js';
import { HeartbeatsController } from './heartbeats.controller.js';
import { HeartbeatProcessor } from './heartbeats.processor.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [HeartbeatsController],
  providers: [HeartbeatsService, HeartbeatProcessor],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}
