// apps/api/src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
// (опц.) можно типизировать payload как Prisma.InputJsonValue при желании

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  constructor(private prisma: PrismaService) {}

  async enqueueEmail(vaultId: string | null, to: string, payload: any) {
    this.logger.log(`[Email][enqueue] to=${to} subj=${payload?.subject ?? ''}`);
    try {
      await this.prisma.notification.create({
        data: {
          // если нужен линк на сейф — передаём как relation
          ...(vaultId ? { vault: { connect: { id: vaultId } } } : {}),
          toContact: to,
          channel: 'email' as any,
          payload: payload as any, // поле JSON в модели Notification
          state: 'Queued' as any,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to enqueue email to=${to}: ${String(e)}`);
    }
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
