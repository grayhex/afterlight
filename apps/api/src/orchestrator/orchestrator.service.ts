import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ActorType, Prisma, VerificationEvent } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { ClockService } from '../clock/clock.service.js';
import {
  ACTIVE_STATES,
  EventState,
  Transition,
  VoteTally,
  canVote,
  evaluate,
  isActive,
} from '../events/event-rules.js';

type Tx = Prisma.TransactionClient;
type VDecision = 'Confirm' | 'Deny';
type Actor = { type: ActorType; id: string };
const DAY_MS = 24 * 3600 * 1000;
const SYSTEM: Actor = { type: ActorType.System, id: 'release-engine' };

export interface EventSummary {
  id: string;
  state: EventState;
  confirms: number;
  denies: number;
  quorum: number;
  grace_until: Date | null;
}

/**
 * Единственное место, где меняется состояние события раскрытия. API и фоновый таймер вызывают только эти операции.
 * Правила переходов — чистая функция `evaluate` (events/event-rules.ts); здесь — права, блокировки, транзакции,
 * аудит и уведомления. Каждый переход выполняется под блокировкой строки события, аудит и намерение отправить письмо
 * пишутся в той же транзакции, поэтому повторный запрос, параллельное голосование и два worker безопасны.
 */
@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private prisma: PrismaService,
    private notify: NotificationsService,
    private audit: AuditService,
    private access: VaultAccessService,
    private clock: ClockService,
  ) {}

  // ─────────────────────────── старт ───────────────────────────

  /** Начать процесс. Владелец/управляющий — всегда; активный верификатор — если владелец неактивен не менее порога (D1, D5). */
  async start(userId: string, vaultId: string): Promise<VerificationEvent> {
    const { asVerifier } = await this.access.assertCanStartEvent(userId, vaultId);
    const now = this.clock.now();

    let event: VerificationEvent;
    try {
      event = await this.prisma.$transaction(async (tx) => {
        // Блокировка сейфа сериализует параллельные старты; частичный уникальный индекс в БД — вторая линия защиты
        await tx.$queryRaw(Prisma.sql`SELECT id FROM vault WHERE id = ${vaultId}::uuid FOR UPDATE`);
        const fresh = await tx.vault.findUniqueOrThrow({ where: { id: vaultId } });
        // Порог неактивности проверяется под блокировкой сейфа: активность владельца (cancelOnOwnerActivity) берёт ту же
        // блокировку, поэтому либо проверка видит свежую активность, либо отмена увидит созданное событие
        if (asVerifier) await this.assertOwnerInactive(tx, fresh, now);
        const active = await tx.verificationEvent.findFirst({
          where: { vaultId, state: { in: [...ACTIVE_STATES] } },
          select: { id: true },
        });
        if (active) throw new ConflictException('A disclosure event is already in progress for this vault');

        const verifiers = await tx.vaultUserRole.findMany({
          where: { vaultId, role: 'Verifier', status: 'Active' },
          select: { userId: true },
        });
        if (verifiers.length < fresh.quorumThreshold) {
          throw new ConflictException('Not enough active verifiers to reach the quorum');
        }

        // Снимок политики: кворум, длительность grace и состав верификаторов фиксируются на момент старта (D4)
        const created = await tx.verificationEvent.create({
          data: {
            vaultId,
            initiator: userId,
            state: 'Submitted',
            quorumRequired: fresh.quorumThreshold,
            graceHours: fresh.graceHours,
            verifierIds: verifiers.map((v) => v.userId),
            createdAt: now,
          },
        });
        await tx.vault.update({ where: { id: vaultId }, data: { status: 'Triggered' } });
        await this.audit.log(ActorType.User, userId, 'event_start', 'VerificationEvent', created.id, undefined, tx);
        await this.notifyParticipants(tx, vaultId, {
          owner: {
            subject: 'AfterLight: начат процесс раскрытия',
            text: 'По вашему сейфу начат процесс раскрытия. Если это ошибка, просто войдите в аккаунт или нажмите «Я жив»: процесс будет отменён.',
          },
          verifiers: {
            subject: 'AfterLight: начат процесс верификации',
            text: 'Начат процесс верификации по сейфу. Перейдите на сайт и примите решение.',
          },
        });
        return created;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A disclosure event is already in progress for this vault');
      }
      throw e;
    }
    await this.flushQuietly();
    return event;
  }

  /** D5: верификатор может начать процесс, только если владелец неактивен >= heartbeat_timeout_days (0 — без порога). */
  private async assertOwnerInactive(tx: Prisma.TransactionClient, vault: { id: string; userId: string; createdAt: Date; heartbeatTimeoutDays: number }, now: Date) {
    const days = vault.heartbeatTimeoutDays;
    if (!days || days <= 0) return;
    const [hb, owner] = await Promise.all([
      tx.heartbeat.findUnique({ where: { vaultId: vault.id } }),
      tx.user.findUnique({ where: { id: vault.userId } }),
    ]);
    const last = Math.max(vault.createdAt.getTime(), hb?.lastPingAt?.getTime() ?? 0, owner?.lastLoginAt?.getTime() ?? 0);
    const eligibleAt = new Date(last + days * DAY_MS);
    if (now.getTime() < eligibleAt.getTime()) {
      throw new ForbiddenException(`The owner was active recently: a verifier can start the process after ${eligibleAt.toISOString()}`);
    }
  }

  // ─────────────────────────── голосование ───────────────────────────

  /** Голос по активному событию сейфа. Автор — только actorId из проверенной сессии. */
  async decide(actorId: string, vaultId: string, decision: VDecision, signature?: string): Promise<EventSummary> {
    await this.access.assertActiveVerifier(actorId, vaultId);
    const active = await this.prisma.verificationEvent.findFirst({
      where: { vaultId, state: { in: [...ACTIVE_STATES] } },
      select: { id: true },
    });
    if (!active) throw new BadRequestException('No active event to accept decisions');
    return this.vote(actorId, active.id, decision, signature);
  }

  /** Голос по конкретному событию (API /verification-events/:id/confirm|deny). Те же правила, что и у decide. */
  async decideOnEvent(actorId: string, eventId: string, decision: VDecision, signature?: string): Promise<EventSummary> {
    const event = await this.prisma.verificationEvent.findUnique({ where: { id: eventId }, select: { vaultId: true } });
    if (!event) throw new NotFoundException('Event not found');
    await this.access.assertActiveVerifier(actorId, event.vaultId);
    return this.vote(actorId, eventId, decision, signature);
  }

  private async vote(actorId: string, eventId: string, decision: VDecision, signature?: string): Promise<EventSummary> {
    const now = this.clock.now();
    const result = await this.locked(eventId, async (tx, ev) => {
      if (!ev.verifierIds.includes(actorId)) {
        throw new ForbiddenException('Not a participant of this event: the composition is fixed at its start');
      }
      if (!canVote(ev, decision, now)) throw new ConflictException(this.voteRejection(ev, decision, now));

      await tx.verificationDecision.upsert({
        where: { verificationEventId_userId: { verificationEventId: eventId, userId: actorId } },
        create: { verificationEventId: eventId, userId: actorId, decision, signature: signature ?? null },
        update: { decision, signature: signature ?? undefined, decidedAt: now },
      });
      await this.audit.log(ActorType.User, actorId, `event_vote:${decision}`, 'VerificationEvent', eventId, undefined, tx);
      return this.advance(tx, ev, now, { type: ActorType.User, id: actorId });
    });
    await this.flushQuietly();
    const { transition: _transition, ...summary } = result!;
    return summary;
  }

  private voteRejection(ev: VerificationEvent, decision: VDecision, now: Date): string {
    switch (ev.state) {
      case 'Disputed':
        return 'The event is disputed: voting is frozen until the lock expires';
      case 'Grace':
        if (decision === 'Confirm') return 'The quorum is reached: confirmations are locked, only Deny is accepted during the grace period';
        return ev.graceUntil && now >= ev.graceUntil ? 'The grace period is over' : 'The event does not accept this decision';
      default:
        return 'The event is closed and does not accept decisions';
    }
  }

  // ─────────────────────────── отмена владельцем ───────────────────────────

  /** D3: владелец отменяет процесс в любом активном состоянии до Finalized («Я жив»). */
  async cancel(ownerId: string, vaultId: string, eventId?: string): Promise<{ id: string; state: EventState }> {
    await this.access.assertOwner(ownerId, vaultId);
    if (eventId) {
      // Отмена по id касается только указанного события: устаревший клиент не отменит чужой, более новый процесс
      const target = await this.prisma.verificationEvent.findFirst({ where: { id: eventId, vaultId }, select: { id: true } });
      if (!target) throw new NotFoundException('Event not found');
      const res = await this.cancelEvent(target.id, ownerId, 'event_cancel');
      await this.flushQuietly();
      return res;
    }
    const active = await this.prisma.verificationEvent.findFirst({
      where: { vaultId, state: { in: [...ACTIVE_STATES] } },
      select: { id: true },
    });
    if (!active) {
      // Если процесс только что завершился (Finalized) — отмена уже невозможна, это не «нет процесса»
      const last = await this.prisma.verificationEvent.findFirst({ where: { vaultId }, orderBy: { createdAt: 'desc' }, select: { state: true } });
      if (last?.state === 'Finalized') throw new ConflictException('The event is already finalized: cancellation is no longer possible');
      throw new NotFoundException('No active event to cancel');
    }
    const res = await this.cancelEvent(active.id, ownerId, 'event_cancel');
    await this.flushQuietly();
    return res;
  }

  /**
   * D5: любая активность владельца после старта процесса (вход, heartbeat-ping) подтверждает, что он жив, и отменяет
   * активные процессы по его сейфам. Вызывается из входа и ping; сбой отмены не должен ломать вход/ping, но логируется.
   */
  async cancelOnOwnerActivity(ownerId: string, reason: 'login' | 'ping'): Promise<number> {
    // Барьер: ждём завершения параллельных стартов по сейфам владельца (они держат блокировку сейфа до коммита).
    // Метка активности записана до вызова, поэтому следующий старт увидит её, а уже начатый — будет найден ниже.
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT id FROM vault WHERE user_id = ${ownerId}::uuid ORDER BY id FOR UPDATE`);
    });
    const events = await this.prisma.verificationEvent.findMany({
      where: { vault: { userId: ownerId }, state: { in: [...ACTIVE_STATES] } },
      select: { id: true },
    });
    let cancelled = 0;
    for (const e of events) {
      try {
        await this.cancelEvent(e.id, ownerId, `event_cancel_on_owner_activity:${reason}`);
        cancelled++;
      } catch (err) {
        // Событие могло завершиться между выборкой и блокировкой (Finalized/уже отменено) — это не ошибка
        if (!(err instanceof ConflictException)) this.logger.error(`cancelOnOwnerActivity failed for event ${e.id}: ${String(err)}`);
      }
    }
    if (cancelled) await this.flushQuietly();
    return cancelled;
  }

  private async cancelEvent(eventId: string, ownerId: string, auditAction: string) {
    const now = this.clock.now();
    return this.locked(eventId, async (tx, ev) => {
      if (!isActive(ev.state as EventState)) {
        throw new ConflictException(
          ev.state === 'Finalized' ? 'The event is already finalized: cancellation is no longer possible' : 'The event is already closed',
        );
      }
      const res = await tx.verificationEvent.updateMany({
        where: { id: ev.id, state: ev.state },
        data: { state: 'Cancelled', closedAt: now, cancelledBy: ownerId },
      });
      if (res.count !== 1) throw new ConflictException('The event changed concurrently');
      await tx.vault.update({ where: { id: ev.vaultId }, data: { status: 'Active' } });
      await this.audit.log(ActorType.User, ownerId, auditAction, 'VerificationEvent', ev.id, undefined, tx);
      await this.notifyParticipants(tx, ev.vaultId, {
        owner: { subject: 'AfterLight: процесс раскрытия отменён', text: 'Процесс раскрытия отменён: вы подтвердили, что с вами всё в порядке.' },
        verifiers: { subject: 'AfterLight: процесс раскрытия отменён', text: 'Владелец сейфа подтвердил активность: процесс отменён, решения не требуются.' },
      });
      return { id: ev.id, state: 'Cancelled' as EventState };
    }) as Promise<{ id: string; state: EventState }>;
  }

  // ─────────────────────────── таймеры ───────────────────────────

  /**
   * Периодическая обработка сроков: завершить grace, закрыть спор по истечении блокировки. Сроки лежат в БД,
   * обработка идемпотентна (каждое событие — под блокировкой строки с SKIP LOCKED, повтор ничего не меняет),
   * поэтому перезапуск и несколько worker безопасны. `now` передаётся явно для проверок «до/на/после deadline».
   */
  async processTimers(now: Date = this.clock.now()): Promise<{ finalized: number; rejected: number }> {
    const due = await this.prisma.verificationEvent.findMany({
      where: {
        OR: [
          { state: 'Grace', graceUntil: { lte: now } },
          { state: 'Disputed', disputedUntil: { lte: now } },
        ],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    let finalized = 0;
    let rejected = 0;
    for (const { id } of due) {
      try {
        const out = await this.locked(id, (tx, ev) => this.advance(tx, ev, now, SYSTEM), { skipLocked: true });
        if (out?.state === 'Finalized' && out.transition === 'finalize') finalized++;
        if (out?.state === 'Rejected' && out.transition === 'reject') rejected++;
      } catch (e) {
        // Сбой одного события (например, постановки письма) откатывает только его транзакцию: событие останется как было
        // и будет обработано при следующем проходе; остальные события не страдают.
        this.logger.error(`Timer processing failed for event ${id}: ${String(e)}`);
      }
    }
    if (finalized || rejected) await this.flushQuietly();
    return { finalized, rejected };
  }

  // ─────────────────────────── ядро ───────────────────────────

  /** Выполняет `fn` в транзакции под блокировкой строки события; skipLocked — пропустить занятое другим worker. */
  private async locked<T>(
    eventId: string,
    fn: (tx: Tx, ev: VerificationEvent) => Promise<T>,
    opts: { skipLocked?: boolean } = {},
  ): Promise<T | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<{ id: string }[]>(
        Prisma.sql`SELECT id FROM verification_event WHERE id = ${eventId}::uuid FOR UPDATE ${opts.skipLocked ? Prisma.sql`SKIP LOCKED` : Prisma.empty}`,
      );
      if (rows.length === 0) {
        if (opts.skipLocked) return null;
        throw new NotFoundException('Event not found');
      }
      const ev = await tx.verificationEvent.findUniqueOrThrow({ where: { id: eventId } });
      return fn(tx, ev);
    });
  }

  /** Голоса только тех участников снимка, кто и сейчас активный верификатор сейфа (отозванные не учитываются). */
  private async tally(tx: Tx, ev: VerificationEvent): Promise<VoteTally> {
    const roles = await tx.vaultUserRole.findMany({
      where: { vaultId: ev.vaultId, role: 'Verifier', status: 'Active', userId: { in: ev.verifierIds } },
      select: { userId: true },
    });
    const ids = roles.map((r) => r.userId);
    if (ids.length === 0) return { confirms: 0, denies: 0 };
    const decisions = await tx.verificationDecision.findMany({ where: { verificationEventId: ev.id, userId: { in: ids } } });
    return {
      confirms: decisions.filter((d) => d.decision === 'Confirm').length,
      denies: decisions.filter((d) => d.decision === 'Deny').length,
    };
  }

  /** Вычислить и применить переход события (под блокировкой). Возвращает краткое состояние для ответа API. */
  private async advance(
    tx: Tx,
    ev: VerificationEvent,
    now: Date,
    actor: Actor,
  ): Promise<EventSummary & { transition: Transition['kind'] }> {
    const tally = await this.tally(tx, ev);
    const t = evaluate(
      { state: ev.state as EventState, quorumRequired: ev.quorumRequired, graceHours: ev.graceHours, graceUntil: ev.graceUntil, disputedUntil: ev.disputedUntil },
      tally,
      now,
    );

    const data: Prisma.VerificationEventUpdateManyMutationInput = { confirmsCount: tally.confirms, deniesCount: tally.denies };
    let graceUntil = ev.graceUntil;
    if (t.to !== ev.state) data.state = t.to;
    if (t.kind === 'dispute') data.disputedUntil = t.disputedUntil;
    if (t.kind === 'grace') {
      data.graceStartedAt = t.graceStartedAt;
      data.graceUntil = t.graceUntil;
      graceUntil = t.graceUntil;
    }
    if (t.kind === 'finalize') data.finalizedAt = now;
    if (t.kind === 'reject') data.closedAt = now;

    const res = await tx.verificationEvent.updateMany({ where: { id: ev.id, state: ev.state }, data });
    if (res.count !== 1) throw new ConflictException('The event changed concurrently');

    if (t.kind !== 'none') await this.onTransition(tx, ev, t, actor, graceUntil);

    return { id: ev.id, state: t.to, confirms: tally.confirms, denies: tally.denies, quorum: ev.quorumRequired, grace_until: graceUntil, transition: t.kind };
  }

  private async onTransition(tx: Tx, ev: VerificationEvent, t: Transition, actor: Actor, graceUntil: Date | null) {
    const log = (action: string) => this.audit.log(actor.type, actor.id, action, 'VerificationEvent', ev.id, undefined, tx);
    switch (t.kind) {
      case 'dispute':
        await log('event_disputed');
        await this.notifyParticipants(tx, ev.vaultId, {
          owner: { subject: 'AfterLight: спор подтверждений', text: 'Верификаторы подали противоположные решения. Процесс заморожен на 24 часа.' },
          verifiers: { subject: 'AfterLight: спор подтверждений', text: 'Подтверждения противоречат друг другу. Процесс заморожен на 24 часа.' },
        });
        break;
      case 'grace': {
        await tx.vault.update({ where: { id: ev.vaultId }, data: { status: 'PendingGrace' } });
        await log('event_grace_started');
        const until = graceUntil!.toISOString();
        await this.notifyParticipants(tx, ev.vaultId, {
          owner: { subject: 'AfterLight: кворум достигнут', text: `Кворум подтверждений достигнут. Раскрытие не ранее ${until}. Чтобы отменить процесс, войдите в аккаунт или нажмите «Я жив».` },
          verifiers: { subject: 'AfterLight: кворум достигнут', text: `Кворум подтверждений достигнут. Раскрытие не ранее ${until}.` },
        });
        break;
      }
      case 'finalize':
        await tx.vault.update({ where: { id: ev.vaultId }, data: { status: 'Released' } });
        await log('event_finalized');
        await this.notifyParticipants(tx, ev.vaultId, {
          owner: { subject: 'AfterLight: процесс завершён', text: 'Процесс раскрытия завершён.' },
          verifiers: { subject: 'AfterLight: процесс завершён', text: 'Процесс раскрытия завершён.' },
        });
        break;
      case 'reject':
        await tx.vault.update({ where: { id: ev.vaultId }, data: { status: 'Active' } });
        await log('event_rejected');
        await this.notifyParticipants(tx, ev.vaultId, {
          owner: { subject: 'AfterLight: процесс закрыт', text: 'Блокировка спора истекла, процесс закрыт без раскрытия. Новый процесс потребует нового запуска.' },
          verifiers: { subject: 'AfterLight: процесс закрыт', text: 'Блокировка спора истекла, процесс закрыт без раскрытия.' },
        });
        break;
    }
  }

  /** Письма владельцу и действующим верификаторам; пишутся в той же транзакции, что и переход. */
  private async notifyParticipants(
    tx: Tx,
    vaultId: string,
    msg: { owner: { subject: string; text: string }; verifiers: { subject: string; text: string } },
  ) {
    const vault = await tx.vault.findUniqueOrThrow({ where: { id: vaultId }, include: { user: { select: { email: true } } } });
    if (vault.user.email) await this.notify.enqueueEmail(vaultId, vault.user.email, msg.owner, tx);
    const roles = await tx.vaultUserRole.findMany({
      where: { vaultId, role: 'Verifier', status: 'Active' },
      include: { user: { select: { email: true } } },
    });
    for (const r of roles) if (r.user.email) await this.notify.enqueueEmail(vaultId, r.user.email, msg.verifiers, tx);
  }

  /** Отправка очереди — после коммита и best-effort: сбой транспорта не откатывает и не повторяет доменную операцию. */
  private async flushQuietly() {
    try {
      await this.notify.flushEmailQueue();
    } catch (e) {
      this.logger.error(`flushEmailQueue failed: ${String(e)}`);
    }
  }
}
