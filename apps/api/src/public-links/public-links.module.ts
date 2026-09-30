import { Module } from '@nestjs/common';
import { PublicLinksService } from './public-links.service.js';
import { PublicLinksController } from './public-links.controller.js';
import { PublicAccessController } from './public.controller.js';
import { AuthModule } from '../auth/auth.module.js';

@Module({
  imports: [AuthModule],
  controllers: [PublicLinksController, PublicAccessController],
  providers: [PublicLinksService],
  exports: [PublicLinksService],
})
export class PublicLinksModule {}
