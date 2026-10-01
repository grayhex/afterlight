import { Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';
import { NotificationsProcessor } from './notifications.processor.js';
import { MailTransport, SmtpMailTransport } from './mail-transport.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  providers: [NotificationsService, NotificationsProcessor, { provide: MailTransport, useClass: SmtpMailTransport }],
  exports: [NotificationsService],
})
export class NotificationsModule {}
