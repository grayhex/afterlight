import { Module } from '@nestjs/common';
import { HeartbeatsService } from './heartbeats.service';
import { HeartbeatsController } from './heartbeats.controller';
import { HeartbeatProcessor } from './heartbeats.processor';

@Module({
  controllers: [HeartbeatsController],
  providers: [HeartbeatsService, HeartbeatProcessor],
  exports: [HeartbeatsService],
})
export class HeartbeatsModule {}
