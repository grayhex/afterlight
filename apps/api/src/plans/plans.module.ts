import { Module } from '@nestjs/common';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
