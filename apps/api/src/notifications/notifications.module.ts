import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
