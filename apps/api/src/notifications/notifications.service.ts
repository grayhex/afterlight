import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClockService } from '../clock/clock.service.js';
import { MailSendError, MailTransport } from './mail-transport.js';
import { loadMailConfig, MailConfig } from './mail.config.js';
import { EmailContent, templates } from './templates.js';

type EmailPayload = { subject: string; text?: string; html?: string };

/** Вид и срок годности письма: kind+supersedeKey — новое письмо снимает неотправленные прежние; expiresAt — позже не отправляем. */
export interface EnqueueOptions {
  kind?: string;
  supersedeKey?: string;
  expiresAt?: Date;
}

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
 *  - после финального состояния тело письма (в нём могут быть токены) из payload удаляется;
 *  - письмо с токеном не живёт дольше токена: после `expires_at` оно снимается (`Cancelled`), а новый запрос того же
 *    вида (сброс пароля) снимает ещё не отправленные прежние письма — получатель не увидит недействительный токен;
 *  - отправка не блокирует запросы: `dispatchSoon` только запускает проход в фоне, медленный SMTP не задерживает API.
 */
@Injectable()
export class NotificationsService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly config: MailConfig = loadMailConfig();
  private draining: Promise<void> | null = null;
  private readonly lateSends = new Set<Promise<unknown>>();
  private readonly renewTimers = new Map<string, NodeJS.Timeout>();
  private again = false;

  constructor(
    private prisma: PrismaService,
    private transport: MailTransport,
    private clock: ClockService,
  ) {}

  /** vaultId — null для системных писем (восстановление аккаунта), не связанных с сейфом. */
  async enqueueEmail(vaultId: string | null, to: string, payload: EmailPayload, tx?: Prisma.TransactionClient, opts: EnqueueOptions = {}) {
    const row = await (tx ?? this.prisma).notification.create({
      data: {
        vaultId,
        toContact: to,
        channel: 'email',
        payload: payload as Prisma.InputJsonValue,
        state: 'Queued',
        nextAttemptAt: this.clock.now(),
        kind: opts.kind,
        supersedeKey: opts.supersedeKey,
        expiresAt: opts.expiresAt,
      },
      select: { id: true },
    });
    this.logger.log(`[Email][enqueue] id=${row.id} to=${mask(to)}`);
  }

  /**
   * Письмо о смене состояния процесса раскрытия. Новое письмо для той же пары «сейф — получатель» снимает ещё не
   * отправленные прежние: после ретрая устаревшее «процесс начат» не должно прийти позже «процесс отменён».
   */
  async enqueueEventMail(vaultId: string, recipientUserId: string, to: string, payload: EmailPayload, tx: Prisma.TransactionClient) {
    const key = `${vaultId}:${recipientUserId}`;
    await this.cancelQueued('event_state', key, 'superseded by a newer process state', tx);
    await this.enqueueEmail(vaultId, to, payload, tx, { kind: 'event_state', supersedeKey: key });
  }

  /** Письмо-приглашение в транзакции вместе с самим приглашением; ключ замены — id приглашения (отзыв снимает письмо). */
  async enqueueVerifierInvitation(vaultId: string, to: string, token: string, expiresAt: Date, invitationId: string, tx: Prisma.TransactionClient) {
    await this.enqueueEmail(vaultId, to, templates.verifierInvitation(token), tx, { kind: 'verifier_invitation', supersedeKey: invitationId, expiresAt });
  }

  /**
   * Снять ещё не отправленные письма данного вида и ключа (токен в них стал недействительным или состояние устарело).
   * Аренда (locked_until) у письма, которое прямо сейчас отправляется, сохраняется: воркер после отправки её снимет,
   * а пока она действует, более новое письмо с тем же ключом не берётся в работу (см. claim) — порядок не нарушается.
   */
  async cancelQueued(kind: string, supersedeKey: string, reason: string, tx?: Prisma.TransactionClient) {
    await (tx ?? this.prisma).notification.updateMany({
      where: { kind, supersedeKey, state: 'Queued' },
      data: { state: 'Cancelled', lastError: reason, payload: { redacted: true } },
    });
  }

  /** Письмо сброса пароля в транзакции вызывающего: прежние неотправленные письма сброса этого пользователя снимаются. */
  async sendPasswordReset(to: string, token: string, userId: string, expiresAt: Date, tx: Prisma.TransactionClient) {
    await this.cancelQueued('password_reset', userId, 'superseded by a newer request', tx);
    await this.enqueueEmail(null, to, templates.passwordReset(token), tx, { kind: 'password_reset', supersedeKey: userId, expiresAt });
  }

  /**
   * Запускает проход очереди в фоне и сразу возвращается: медленный или зависший SMTP не удерживает запрос,
   * а повтор операции клиентом из-за таймаута прокси не нужен. Проходы схлопываются: одновременно идёт не больше одного,
   * а вызовы во время прохода лишь просят о повторе, поэтому всплеск запросов не плодит соединений с БД и SMTP.
   */
  dispatchSoon(): void {
    if (this.draining) {
      this.again = true;
      return;
    }
    this.draining = this.drainLoop();
  }

  private async drainLoop(): Promise<void> {
    try {
      do {
        this.again = false;
        try {
          const res = await this.dispatchDue();
          if (res.claimed) this.logger.log(`[Email] dispatch: sent=${res.sent} retried=${res.retried} failed=${res.failed}`);
          if (res.claimed >= 20) this.again = true; // очередь длиннее пачки — продолжаем
        } catch (e) {
          this.logger.error(`[Email] dispatch failed: ${String(e)}`);
        }
      } while (this.again);
    } finally {
      this.draining = null; // синхронно с проверкой выше: просьба о повторе не теряется
    }
  }

  /** Дожидается идущего фонового прохода (тесты и корректное завершение). */
  async idle(): Promise<void> {
    while (this.draining || this.lateSends.size > 0) await Promise.allSettled([this.draining, ...this.lateSends]);
  }

  async onModuleDestroy() {
    // Ждём фоновые отправки не дольше их собственного предела: зависший SMTP не должен блокировать остановку процесса
    const hold = this.config.sendTimeoutMs * 3;
    let timer: NodeJS.Timeout | undefined;
    await Promise.race([this.idle(), new Promise<void>((resolve) => { timer = setTimeout(resolve, hold); })]);
    clearTimeout(timer);
    // Не успевшие завершиться отправки оборвутся вместе с процессом; на время смены процесса даём им последнюю
    // аренду, чтобы заменяющий воркер не обогнал их более новым письмом
    const pending = [...this.renewTimers.keys()];
    for (const t of this.renewTimers.values()) clearInterval(t);
    this.renewTimers.clear();
    if (pending.length > 0) {
      await this.prisma.notification
        .updateMany({ where: { id: { in: pending } }, data: { lockedUntil: new Date(this.clock.now().getTime() + hold) } })
        .catch((e) => this.logger.error(`[Email] final lease extension failed: ${String(e)}`));
    }
  }

  /** Отправка задач, срок которых наступил. Безопасно вызывать параллельно из нескольких экземпляров. */
  async dispatchDue(limit = 20): Promise<DispatchResult> {
    await this.cancelExpired(this.clock.now());
    const now = this.clock.now();
    const claimed = await this.claim(now, limit);
    const result: DispatchResult = { claimed: claimed.length, sent: 0, retried: 0, failed: 0 };
    for (const n of claimed) {
      const at = this.clock.now();
      // Аренда ограничена: если до этой задачи дошли слишком поздно, её мог забрать другой воркер — не отправляем
      if (n.lockedUntil && at.getTime() >= n.lockedUntil.getTime()) continue;
      if (n.expiresAt && at.getTime() >= n.expiresAt.getTime()) {
        await this.cancel(n.id, 'expired before delivery');
        continue;
      }
      // Задачу могли снять, пока она ждала своей очереди в пачке: перед отправкой перечитываем состояние
      const fresh = await this.prisma.notification.findFirst({ where: { id: n.id, state: 'Queued' }, select: { payload: true } });
      if (!fresh) {
        await this.release(n.id);
        continue;
      }
      const payload = (fresh.payload ?? {}) as EmailPayload;
      try {
        await this.withDeadline(n.id, payload.subject ?? '', this.transport.send({ to: n.toContact, subject: payload.subject ?? '', text: payload.text, html: payload.html }));
      } catch (e) {
        const err = e instanceof MailSendError ? e : new MailSendError(String((e as Error)?.name ?? 'ERROR').replace(/[^A-Za-z0-9_]/g, '').slice(0, 40) || 'ERROR', false);
        const outcome = await this.markFailure(n.id, n.attempts, err);
        // После таймаута отправка ещё идёт в фоне: аренду не снимаем (её держит markFailure), иначе новое письмо обгонит старое
        if (!err.inFlight) await this.release(n.id);
        result[outcome]++;
        continue;
      }
      await this.markSent(n.id, payload.subject ?? '');
      await this.release(n.id);
      result.sent++;
    }
    return result;
  }

  /** Снять аренду у задачи, которую отменили во время отправки (у живых задач аренду снимает markSent/markFailure). */
  private async release(id: string) {
    await this.prisma.notification.updateMany({ where: { id, state: { not: 'Queued' }, lockedUntil: { not: null } }, data: { lockedUntil: null } });
  }

  /**
   * Жёсткий предел на одно сообщение: итог неоднозначен (сервер мог принять письмо), поэтому это временная ошибка.
   * Сам запрос к SMTP прервать нельзя, поэтому после дедлайна аренда задачи удерживается, пока запрос не завершится
   * (holdLease): иначе более новое письмо могло бы обогнать ещё идущую отправку старого.
   */
  private withDeadline(id: string, subject: string, send: Promise<void>): Promise<void> {
    let timer: NodeJS.Timeout;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        this.holdLease(id, subject, send);
        reject(new MailSendError('ETIMEDOUT: no confirmation within the send timeout', false, 'ETIMEDOUT', true));
      }, this.config.sendTimeoutMs);
    });
    send.catch(() => undefined); // поздний отказ после дедлайна не должен стать необработанным
    return Promise.race([send, deadline]).finally(() => clearTimeout(timer));
  }

  /**
   * Пока запрос к SMTP после дедлайна не завершился, продлеваем аренду задачи (если процесс умрёт — аренда истечёт
   * сама). Когда запрос завершился: успех — письмо фактически принято сервером, фиксируем `Sent` (повтор не нужен);
   * отказ — задача остаётся в очереди с уже назначенным повтором. В обоих случаях аренду снимаем.
   */
  private holdLease(id: string, subject: string, send: Promise<void>) {
    const hold = this.config.sendTimeoutMs * 3;
    let stopped = false;
    let renewing: Promise<unknown> | null = null;
    const renew = setInterval(() => {
      if (stopped || renewing) return; // не плодим запросы продления и не запускаем новые после завершения
      const p: Promise<unknown> = this.prisma.notification
        .updateMany({ where: { id }, data: { lockedUntil: new Date(this.clock.now().getTime() + hold) } })
        .catch((e) => this.logger.error(`[Email] lease renewal failed: ${String(e)}`))
        .finally(() => {
          if (renewing === p) renewing = null;
        });
      renewing = p;
    }, this.config.sendTimeoutMs);
    renew.unref();
    this.renewTimers.set(id, renew);
    const settled = (async () => {
      let ok = false;
      try {
        await send;
        ok = true;
      } catch {
        // отказ после дедлайна: повтор уже запланирован markFailure
      }
      stopped = true;
      clearInterval(renew);
      this.renewTimers.delete(id);
      // Уже запущенный запрос продления дожидаемся: иначе он мог бы завершиться после снятия аренды и вернуть её
      await renewing;
      if (ok) await this.markSentLate(id, subject);
      await this.prisma.notification.updateMany({ where: { id, lockedUntil: { not: null } }, data: { lockedUntil: null } });
    })()
      .catch((e) => this.logger.error(`[Email] late send bookkeeping failed: ${String(e)}`))
      .finally(() => this.lateSends.delete(settled));
    this.lateSends.add(settled);
  }

  /** Письма с истёкшим сроком (токен уже недействителен) не отправляются. */
  private async cancelExpired(now: Date) {
    await this.prisma.notification.updateMany({
      where: { state: 'Queued', expiresAt: { lte: now } },
      data: { state: 'Cancelled', lockedUntil: null, lastError: 'expired before delivery', payload: { redacted: true } },
    });
  }

  private async cancel(id: string, reason: string) {
    await this.prisma.notification.updateMany({
      where: { id, state: 'Queued' },
      data: { state: 'Cancelled', lockedUntil: null, lastError: reason, payload: { redacted: true } },
    });
  }

  /** Берём задачи под аренду; SKIP LOCKED — параллельные воркеры получают непересекающиеся наборы. */
  private async claim(now: Date, limit: number) {
    const iso = now.toISOString();
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT id FROM notification
        WHERE channel = 'email'::"NotificationChannel" AND state = 'Queued'::"NotificationState"
          AND next_attempt_at <= ${iso}::timestamp
          AND (locked_until IS NULL OR locked_until <= ${iso}::timestamp)
          -- порядок: пока другое письмо того же вида и ключа в полёте (в любом состоянии: Queued, снятое во время
          -- отправки или Failed после финального таймаута, пока отправка ещё не завершилась), это письмо ждёт. Время создания для порядка не используется:
          -- более старое Queued-письмо при появлении нового снимается, поэтому «в полёте» может быть только предшественник
          AND NOT EXISTS (
            SELECT 1 FROM notification o
            WHERE o.kind = notification.kind AND o.supersede_key = notification.supersede_key
              AND o.id <> notification.id
              AND o.locked_until > ${iso}::timestamp)
        ORDER BY next_attempt_at, created_at
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED`);
      if (rows.length === 0) return [];
      const ids = rows.map((r) => r.id);
      // Аренда рассчитана на всю пачку в худшем случае (каждое письмо — до sendTimeoutMs) плюс запас
      const leaseMs = this.config.sendTimeoutMs * ids.length + 30_000;
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

  /**
   * Запрос к SMTP завершился успешно уже после дедлайна: сервер принял письмо, поэтому итог — `Sent`, даже если за это
   * время задача ушла в повтор, стала `Failed` (финальная попытка) или была снята новым состоянием.
   */
  private async markSentLate(id: string, subject: string) {
    await this.prisma.notification.updateMany({
      where: { id, state: { in: ['Queued', 'Failed', 'Cancelled'] } },
      data: { state: 'Sent', sentAt: this.clock.now(), lockedUntil: null, lastError: null, payload: { subject, redacted: true } },
    });
  }

  private async markFailure(id: string, attempts: number, err: MailSendError): Promise<'retried' | 'failed'> {
    const now = this.clock.now();
    const final = err.permanent || attempts >= this.config.maxAttempts;
    // Отправка после нашего таймаута не прервана и может завершиться позже: удерживаем аренду на время, за которое
    // транспорт (nodemailer) гарантированно сдаётся по собственным таймаутам. Пока она действует, это письмо не берётся
    // повторно, а более новое письмо с тем же ключом ждёт (см. claim)
    const lease = err.inFlight ? new Date(now.getTime() + this.config.sendTimeoutMs * 3) : null;
    if (lease) {
      // Состояние задачи могло измениться (её сняли новым письмом) — аренду продлеваем независимо от состояния, но не сокращаем
      await this.prisma.notification.updateMany({
        where: { id, OR: [{ lockedUntil: null }, { lockedUntil: { lt: lease } }] },
        data: { lockedUntil: lease },
      });
    }
    if (final) {
      await this.prisma.notification.updateMany({
        where: { id, state: 'Queued' },
        data: { state: 'Failed', lockedUntil: lease, lastError: err.message, payload: { redacted: true } },
      });
      this.logger.error(`[Email][failed] id=${id} attempts=${attempts} permanent=${err.permanent} error=${err.message}`);
      return 'failed';
    }
    const delaySec = Math.min(this.config.retryBaseSeconds * 2 ** (attempts - 1), this.config.retryMaxSeconds);
    const retryAt = new Date(now.getTime() + delaySec * 1000);
    await this.prisma.notification.updateMany({
      where: { id, state: 'Queued' },
      data: { lockedUntil: lease, lastError: err.message, nextAttemptAt: lease && lease > retryAt ? lease : retryAt },
    });
    this.logger.warn(`[Email][retry] id=${id} attempt=${attempts} in=${delaySec}s error=${err.message}`);
    return 'retried';
  }
}

export type { EmailContent };
