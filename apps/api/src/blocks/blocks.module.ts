import { Module } from '@nestjs/common';
import { BlocksService } from './blocks.service.js';
import { BlocksController } from './blocks.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [BlocksController],
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
