import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

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

  async sendVerifierInvitation(vaultId: string, to: string, token: string) {
    // Токен передаётся во фрагменте (#): браузер не отправляет его на сервер и он не попадает в access-логи.
    // без localhost-подстановки в production: validateEnv требует WEB_BASE_URL при старте
    const base = (process.env.WEB_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');
    const link = `${base}/invite#token=${token}`;
    await this.enqueueEmail(vaultId, to, {
      subject: 'AfterLight: приглашение доверителя',
      text: `Вас пригласили стать доверителем. Войдите под этим адресом и откройте ссылку: ${link}`,
    });
    await this.flushEmailQueue();
  }

  async flushEmailQueue(limit = 50) {
    const queued = await this.prisma.notification.findMany({
      where: { channel: 'email' as any, state: 'Queued' as any },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });
    for (const n of queued) {
      // Тело письма может содержать одноразовые токены (приглашения, сброс пароля): в логи не попадает.
      this.logger.log(`[Email][send] id=${n.id} to=${n.toContact} subj=${(n.payload as any)?.subject ?? ''}`);
      await this.prisma.notification.update({
        where: { id: n.id },
        data: { state: 'Sent' as any },
      });
    }
    return queued.length;
  }
}
