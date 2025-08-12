import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type EmailPayload = {
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  context?: Record<string, any>;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService) {}

  // vaultId теперь обязателен
  async enqueueEmail(vaultId: string, to: string, payload: EmailPayload) {
    this.logger.log(`[Email][enqueue] to=${to} subj=${payload.subject}`);
    await this.prisma.notification.create({
      data: {
        // обязательная связь с сейфом
        vault: { connect: { id: vaultId } },
        toContact: to,
        channel: 'email' as any,
        payload: payload as any,
        state: 'Queued' as any,
      },
    });
  }

  async flushEmailQueue(limit = 50) {
    const queued = await this.prisma.notification.findMany({
      where: { channel: 'email' as any, state: 'Queued' as any },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const n of queued) {
      this.logger.log(`[Email][send] to=${n.toContact} payload=${JSON.stringify(n.payload)}`);
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { state: 'Sent' as any },
      });
    }
    return queued.length;
  }
}
