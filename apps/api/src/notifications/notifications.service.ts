import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClockService } from '../clock/clock.service.js';
import { MailSendError, MailTransport } from './mail-transport.js';
import { loadMailConfig, MailConfig } from './mail.config.js';
import { EmailContent, templates } from './templates.js';

type EmailPayload = { subject: string; text?: string; html?: string };

export interface DispatchResult {
  claimed: number;
  sent: number;
  retried: number;
  failed: number;
}

/** Маска адреса для логов: a***@domain. */
function mask(email: string): string {
  const at = email.lastIndexOf('@');
  return at <= 0 ? '***' : `${email[0]}***${email.slice(at)}`;
}

/**
 * Очередь email. Намерение уведомить пишется в одной транзакции с доменным изменением (tx); отправка — отдельно:
 *  - задача берётся воркером под арендой (`SELECT … FOR UPDATE SKIP LOCKED` + locked_until), поэтому несколько
 *    экземпляров не отправляют одно письмо дважды, а после падения воркера аренда истекает и задача возвращается;
 *  - `Sent` ставится только после того, как транспорт подтвердил приём сообщения сервером (SMTP 250);
 *  - временная ошибка → повтор с экспоненциальным backoff до MAIL_MAX_ATTEMPTS, затем `Failed` с диагностикой;
 *    окончательный отказ (5xx, неверный адрес) → сразу `Failed`; текст ошибки без тела письма и секретов;
 *  - гарантия «как минимум один раз»: если процесс упал после приёма письма сервером, но до записи `Sent`,
 *    письмо уйдёт повторно. Повтор безопасен: письмо — только уведомление, действие по нему выполняется по токену
 *    в ссылке и не зависит от числа писем; доменная операция при повторе не выполняется;
 *  - после финального состояния тело письма (в нём могут быть токены) из payload удаляется.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly config: MailConfig = loadMailConfig();

  constructor(
    private prisma: PrismaService,
    private transport: MailTransport,
    private clock: ClockService,
  ) {}

  /** vaultId — null для системных писем (восстановление аккаунта), не связанных с сейфом. */
  async enqueueEmail(vaultId: string | null, to: string, payload: EmailPayload, tx?: Prisma.TransactionClient) {
    const row = await (tx ?? this.prisma).notification.create({
      data: {
        vaultId,
        toContact: to,
        channel: 'email',
        payload: payload as Prisma.InputJsonValue,
        state: 'Queued',
        nextAttemptAt: this.clock.now(),
      },
      select: { id: true },
    });
    this.logger.log(`[Email][enqueue] id=${row.id} to=${mask(to)}`);
  }

  async sendVerifierInvitation(vaultId: string, to: string, token: string) {
    await this.enqueueEmail(vaultId, to, templates.verifierInvitation(token));
    await this.dispatchSoon();
  }

  async sendPasswordReset(to: string, token: string, tx?: Prisma.TransactionClient) {
    await this.enqueueEmail(null, to, templates.passwordReset(token), tx);
  }

  /** Попытка отправить очередь сразу после коммита; сбой не должен ломать вызывающую операцию. */
  async dispatchSoon(): Promise<void> {
    try {
      await this.dispatchDue();
    } catch (e) {
      this.logger.error(`[Email] dispatch failed: ${String(e)}`);
    }
  }

  /** Отправка задач, срок которых наступил. Безопасно вызывать параллельно из нескольких экземпляров. */
  async dispatchDue(limit = 20): Promise<DispatchResult> {
    const now = this.clock.now();
    const claimed = await this.claim(now, limit);
    const result: DispatchResult = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 };
    for (const n of claimed) {
      const payload = (n.payload ?? {}) as EmailPayload;
      try {
        await this.transport.send({ to: n.toContact, subject: payload.subject ?? '', text: payload.text, html: payload.html });
      } catch (e) {
        const err = e instanceof MailSendError ? e : new MailSendError(String((e as Error)?.message ?? e).slice(0, 300), false);
        const outcome = await this.markFailure(n.id, n.attempts, err);
        result[outcome]++;
        continue;
      }
      await this.markSent(n.id, payload.subject ?? '');
      result.sent++;
    }
    return result;
  }

  /** Берём задачи под аренду; SKIP LOCKED — параллельные воркеры получают непересекающиеся наборы. */
  private async claim(now: Date, limit: number) {
    const iso = now.toISOString();
    const leaseMs = Math.max(this.config.sendTimeoutMs * 4, 60_000);
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM notification
        WHERE channel = 'email'::"NotificationChannel" AND state = 'Queued'::"NotificationState"
          AND next_attempt_at <= ${iso}::timestamp
          AND (locked_until IS NULL OR locked_until <= ${iso}::timestamp)
        ORDER BY next_attempt_at, created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`);
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      await tx.notification.updateMany({
        where: { id: { in: ids } },
        data: { lockedUntil: new Date(now.getTime() + leaseMs), attempts: { increment: 1 } },
      });
      return tx.notification.findMany({ where: { id: { in: ids } }, orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }] });
    });
  }

  private async markSent(id: string, subject: string) {
    await this.prisma.notification.updateMany({
      where: { id, state: 'Queued' },
      data: { state: 'Sent', sentAt: this.clock.now(), lockedUntil: null, lastError: null, payload: { subject, redacted: true } },
    });
  }

  private async markFailure(id: string, attempts: number, err: MailSendError): Promise<'retried' | 'failed'> {
    const now = this.clock.now();
    const final = err.permanent || attempts >= this.config.maxAttempts;
    if (final) {
      await this.prisma.notification.updateMany({
        where: { id, state: 'Queued' },
        data: { state: 'Failed', lockedUntil: null, lastError: err.message, payload: { redacted: true } },
      });
      this.logger.error(`[Email][failed] id=${id} attempts=${attempts} permanent=${err.permanent} error=${err.message}`);
      return 'failed';
    }
    const delaySec = Math.min(this.config.retryBaseSeconds * 2 ** (attempts - 1), this.config.retryMaxSeconds);
    await this.prisma.notification.updateMany({
      where: { id, state: 'Queued' },
      data: { lockedUntil: null, lastError: err.message, nextAttemptAt: new Date(now.getTime() + delaySec * 1000) },
    });
    this.logger.warn(`[Email][retry] id=${id} attempt=${attempts} in=${delaySec}s error=${err.message}`);
    return 'retried';
  }
}

export type { EmailContent };
