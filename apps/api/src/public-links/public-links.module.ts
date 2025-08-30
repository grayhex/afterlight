import { Module } from '@nestjs/common';
import { PublicLinksService } from './public-links.service';
import { PublicLinksController } from './public-links.controller';
import { PublicAccessController } from './public.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [PublicLinksController, PublicAccessController],
  providers: [PublicLinksService],
  exports: [PublicLinksService],
})
export class PublicLinksModule {}
