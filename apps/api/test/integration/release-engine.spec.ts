import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service.js';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { AuditService } from '../../src/audit/audit.service.js';
import { VaultAccessService } from '../../src/vault-access/vault-access.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';
import { hashPassword } from '../../src/auth/password.js';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

const H = 3600 * 1000;
const D = 24 * H;

describe('release engine (real PostgreSQL, managed clock)', () => {
  let ctx: Ctx;
  let t0: Date;
  const at = (ms: number) => new Date(t0.getTime() + ms);
  const svc = () => ctx.moduleRef.get(OrchestratorService);

  beforeEach(async () => {
    ctx = await bootstrapApp();
    t0 = new Date();
    ctx.clock.setNow(t0);
  });
  afterEach(async () => { await closeApp(ctx); });

  async function scene(vaultAttrs: Record<string, unknown> = {}) {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2, graceHours: 24, heartbeatTimeoutDays: 30, ...vaultAttrs });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);
    const v3 = await ctx.factory.createVerifier(vault.id);
    const outsider = await ctx.factory.createUser();
    return { owner, vault, v1, v2, v3, outsider };
  }
  type S = Awaited<ReturnType<typeof scene>>;

  const start = (s: S, who = s.owner.id) => ctx.request('POST', '/orchestration/start', { vault_id: s.vault.id }, who);
  const vote = (s: S, who: string, decision: 'Confirm' | 'Deny') =>
    ctx.request('POST', '/orchestration/decision', { vault_id: s.vault.id, decision }, who);
  const cancel = (s: S, who = s.owner.id) => ctx.request('POST', '/orchestration/cancel', { vault_id: s.vault.id }, who);
  const event = (s: S) => ctx.db.verificationEvent.findFirstOrThrow({ where: { vaultId: s.vault.id }, orderBy: { createdAt: 'desc' } });
  const vaultStatus = async (s: S) => (await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).status;
  const mails = (subject: string) => ctx.db.notification.count({ where: { payload: { path: ['subject'], equals: subject } } });

  /** Событие в состоянии Grace: старт сейчас, два подтверждения. */
  async function toGrace(s: S) {
    expect((await start(s)).status).toBe(201);
    expect((await vote(s, s.v1.user.id, 'Confirm')).status).toBe(201);
    const second = await vote(s, s.v2.user.id, 'Confirm');
    expect(second.body.state).toBe('Grace');
    return second.body;
  }

  describe('full grace', () => {
    it('is measured from the quorum, not from event creation; finalizes exactly at the deadline, once', async () => {
      const s = await scene();
      expect((await start(s)).status).toBe(201);

      ctx.clock.setNow(at(5 * D)); // долгое ожидание голосов
      await vote(s, s.v1.user.id, 'Confirm');
      const q = await vote(s, s.v2.user.id, 'Confirm');
      expect(q.body).toMatchObject({ state: 'Grace', confirms: 2, quorum: 2 });
      const graceUntil = at(5 * D + 24 * H);
      expect(new Date(q.body.grace_until)).toEqual(graceUntil);
      expect((await event(s)).graceStartedAt).toEqual(at(5 * D));
      expect(await vaultStatus(s)).toBe('PendingGrace');

      // сразу после кворума и за мгновение до deadline — не раскрывается, хотя с создания события прошло больше суток
      expect(await svc().processTimers(at(5 * D))).toEqual({ finalized: 0, rejected: 0 });
      expect(await svc().processTimers(new Date(graceUntil.getTime() - 1))).toEqual({ finalized: 0, rejected: 0 });
      expect((await event(s)).state).toBe('Grace');

      // ровно на deadline — один раз
      expect(await svc().processTimers(graceUntil)).toEqual({ finalized: 1, rejected: 0 });
      const done = await event(s);
      expect(done.state).toBe('Finalized');
      expect(done.finalizedAt).toEqual(graceUntil);
      expect(await vaultStatus(s)).toBe('Released');

      // повторная обработка ничего не меняет и не создаёт второго раскрытия/писем
      const mailsBefore = await mails('AfterLight: процесс завершён');
      expect(mailsBefore).toBe(4); // владелец + 3 верификатора
      expect(await svc().processTimers(at(50 * D))).toEqual({ finalized: 0, rejected: 0 });
      expect(await mails('AfterLight: процесс завершён')).toBe(mailsBefore);
      expect(await ctx.db.auditLog.count({ where: { action: 'event_finalized' } })).toBe(1);
    });

    it('uses the grace length snapshotted at the start', async () => {
      const s = await scene({ graceHours: 6 });
      await toGrace(s);
      expect((await event(s)).graceUntil).toEqual(at(6 * H));
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { graceHours: 72 } }); // правка в обход API не влияет на идущий процесс
      expect(await svc().processTimers(at(6 * H))).toEqual({ finalized: 1, rejected: 0 });
    });
  });

  describe('dispute', () => {
    it('freezes for 24h, then closes as Rejected; a new process is a new event without old votes', async () => {
      const s = await scene();
      await start(s);
      await vote(s, s.v1.user.id, 'Confirm');
      expect((await vote(s, s.v2.user.id, 'Deny')).body.state).toBe('Disputed');
      expect((await event(s)).disputedUntil).toEqual(at(24 * H));

      // во время блокировки голосовать нельзя; новый старт невозможен (процесс ещё активен)
      expect((await vote(s, s.v3.user.id, 'Confirm')).status).toBe(409);
      expect((await start(s)).status).toBe(409);
      expect(await svc().processTimers(at(24 * H - 1))).toEqual({ finalized: 0, rejected: 0 });

      expect(await svc().processTimers(at(24 * H))).toEqual({ finalized: 0, rejected: 1 });
      expect((await event(s)).state).toBe('Rejected');
      expect(await vaultStatus(s)).toBe('Active');

      // спор закрывается один раз: повторные проходы не плодят события
      await svc().processTimers(at(48 * H));
      await svc().processTimers(at(72 * H));
      expect(await ctx.db.verificationEvent.count({ where: { vaultId: s.vault.id } })).toBe(1);

      ctx.clock.setNow(at(73 * H));
      const again = await start(s);
      expect(again.status).toBe(201);
      expect(await ctx.db.verificationDecision.count({ where: { verificationEventId: again.body.id } })).toBe(0);
    });

    it('a Deny during grace stops the disclosure (D6); confirmations are locked; a late Deny is refused', async () => {
      const s = await scene();
      await toGrace(s);
      expect((await vote(s, s.v3.user.id, 'Confirm')).status).toBe(409); // кворум достигнут: подтверждения заблокированы
      const deny = await vote(s, s.v3.user.id, 'Deny');
      expect(deny.status).toBe(201);
      expect(deny.body.state).toBe('Disputed');
      expect(await svc().processTimers(at(25 * H))).toEqual({ finalized: 0, rejected: 1 }); // не раскрылось: спор → Rejected

      const s2 = await scene();
      await toGrace(s2);
      ctx.clock.setNow(at(25 * H));
      expect((await vote(s2, s2.v3.user.id, 'Deny')).status).toBe(409); // grace уже закончился
      expect(await svc().processTimers(at(25 * H))).toEqual({ finalized: 1, rejected: 0 });
    });

    it('a vote can be changed until the quorum, not after', async () => {
      const s = await scene();
      await start(s);
      await vote(s, s.v1.user.id, 'Confirm');
      await vote(s, s.v1.user.id, 'Deny'); // смена решения до кворума: спора нет, остался один Deny
      const ev = await event(s);
      expect(ev).toMatchObject({ state: 'Submitted', confirmsCount: 0, deniesCount: 1 });
      expect(await ctx.db.verificationDecision.count({ where: { verificationEventId: ev.id } })).toBe(1);
    });
  });

  describe('cancel by the owner (D3)', () => {
    it.each(['Submitted', 'Confirming', 'Disputed', 'Grace'])('works from %s: nothing is disclosed afterwards', async (state) => {
      const s = await scene();
      await start(s);
      if (state === 'Confirming') await vote(s, s.v1.user.id, 'Confirm');
      if (state === 'Disputed') { await vote(s, s.v1.user.id, 'Confirm'); await vote(s, s.v2.user.id, 'Deny'); }
      if (state === 'Grace') { await vote(s, s.v1.user.id, 'Confirm'); await vote(s, s.v2.user.id, 'Confirm'); }
      expect((await event(s)).state).toBe(state);

      const res = await cancel(s);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ state: 'Cancelled' });
      const ev = await event(s);
      expect(ev).toMatchObject({ state: 'Cancelled', cancelledBy: s.owner.id });
      expect(ev.closedAt).not.toBeNull();
      expect(await vaultStatus(s)).toBe('Active');

      expect(await svc().processTimers(at(100 * D))).toEqual({ finalized: 0, rejected: 0 });
      expect((await event(s)).state).toBe('Cancelled');
      expect((await cancel(s)).status).toBe(404); // повторная отмена: активного процесса нет
      expect((await vote(s, s.v3.user.id, 'Confirm')).status).toBe(400);
    });

    it('is owner-only and impossible after finalization', async () => {
      const s = await scene();
      await toGrace(s);
      for (const who of [s.v1.user.id, s.outsider.id]) expect((await cancel(s, who)).status).toBe(403);
      expect((await ctx.request('POST', '/orchestration/cancel', { vault_id: s.vault.id })).status).toBe(401);
      expect((await event(s)).state).toBe('Grace');

      await svc().processTimers(at(25 * H));
      const late = await cancel(s);
      expect(late.status).toBe(409);
      expect((await event(s)).state).toBe('Finalized');
    });

    it('legacy route /verification-events/:id/cancel uses the same operation', async () => {
      const s = await scene();
      const started = await start(s);
      expect((await ctx.request('POST', `/verification-events/${started.body.id}/cancel`, undefined, s.v1.user.id)).status).toBe(403);
      expect((await ctx.request('POST', `/verification-events/${started.body.id}/cancel`, undefined, s.owner.id)).status).toBe(201);
      expect((await event(s)).state).toBe('Cancelled');
    });

    it('cancel by id touches only that event: a stale id never cancels a newer process', async () => {
      const s = await scene();
      const first = await start(s);
      expect((await cancel(s)).status).toBe(201);
      const second = await start(s);
      expect(second.status).toBe(201);

      const stale = await ctx.request('POST', `/verification-events/${first.body.id}/cancel`, undefined, s.owner.id);
      expect(stale.status).toBe(409);
      expect((await ctx.db.verificationEvent.findUniqueOrThrow({ where: { id: second.body.id } })).state).toBe('Submitted');
      expect(await vaultStatus(s)).toBe('Triggered');

      // id чужого сейфа не подходит ни при каких условиях
      const other = await scene();
      const foreign = await start(other);
      expect((await ctx.request('POST', `/verification-events/${foreign.body.id}/cancel`, undefined, s.owner.id)).status).toBe(403);
    });

    it('race: cancel and finalization at the deadline — exactly one wins and the outcome is consistent', async () => {
      for (let i = 0; i < 6; i++) {
        const s = await scene();
        await toGrace(s);
        const deadline = at(24 * H);
        ctx.clock.setNow(deadline);
        const [c, tick] = await Promise.all([cancel(s), svc().processTimers(deadline)]);
        const ev = await event(s);
        if (ev.state === 'Finalized') {
          expect(c.status).toBe(409);
          expect(tick.finalized).toBe(1);
          expect(await vaultStatus(s)).toBe('Released');
        } else {
          expect(ev.state).toBe('Cancelled');
          expect(c.status).toBe(201);
          expect(tick.finalized).toBe(0);
          expect(await vaultStatus(s)).toBe('Active');
        }
        ctx.clock.setNow(t0);
      }
    });
  });

  describe('one active process per vault', () => {
    it('a second start is refused; six parallel starts create exactly one event', async () => {
      const s = await scene();
      const results = await Promise.all(Array.from({ length: 6 }, () => start(s)));
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(results.filter((r) => r.status === 409)).toHaveLength(5);
      expect(await ctx.db.verificationEvent.count({ where: { vaultId: s.vault.id } })).toBe(1);
      expect((await start(s)).status).toBe(409);
    });

    it('the database itself refuses a second active event, even when the service is bypassed', async () => {
      const s = await scene();
      await start(s);
      await expect(
        ctx.db.verificationEvent.create({ data: { vaultId: s.vault.id, state: 'Submitted', quorumRequired: 2 } }),
      ).rejects.toThrow();
    });

    it('needs enough active verifiers for the quorum', async () => {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      await ctx.factory.createVerifier(vault.id);
      const res = await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
      expect(res.status).toBe(409);
    });
  });

  describe('who can start (D1) and the inactivity threshold (D5)', () => {
    it('a verifier can start only after the owner has been inactive for the threshold; the owner always can', async () => {
      const s = await scene();
      const early = await start(s, s.v1.user.id);
      expect(early.status).toBe(403);
      expect(await ctx.db.verificationEvent.count()).toBe(0);
      expect((await start(s, s.outsider.id)).status).toBe(403);

      ctx.clock.setNow(at(29 * D));
      expect((await start(s, s.v1.user.id)).status).toBe(403);
      // порог отсчитывается от createdAt сейфа (чуть позже t0), поэтому берём момент с небольшим запасом
      ctx.clock.setNow(new Date(s.vault.createdAt.getTime() + 30 * D - 1000));
      expect((await start(s, s.v1.user.id)).status).toBe(403);
      ctx.clock.setNow(new Date(s.vault.createdAt.getTime() + 30 * D));
      const ok = await start(s, s.v1.user.id);
      expect(ok.status).toBe(201);
      expect((await event(s)).initiator).toBe(s.v1.user.id);
    });

    it('the owner ping moves the threshold; threshold 0 removes it', async () => {
      const s = await scene();
      ctx.clock.setNow(at(40 * D));
      await ctx.request('POST', '/heartbeats/ping', { vault_id: s.vault.id }, s.owner.id);
      expect((await start(s, s.v1.user.id)).status).toBe(403);

      const s0 = await scene({ heartbeatTimeoutDays: 0 });
      expect((await start(s0, s0.v1.user.id)).status).toBe(201);
    });

    it('a verifier start racing with an owner ping never leaves an active process behind', async () => {
      for (let i = 0; i < 5; i++) {
        const s = await scene();
        ctx.clock.setNow(new Date(s.vault.createdAt.getTime() + 31 * D)); // порог уже пройден
        const [started, pinged] = await Promise.all([
          start(s, s.v1.user.id),
          ctx.request('POST', '/heartbeats/ping', { vault_id: s.vault.id }, s.owner.id),
        ]);
        expect(pinged.status).toBe(201);
        expect([201, 403]).toContain(started.status);
        // либо проверка увидела свежую активность (403), либо ping отменил созданный процесс
        expect(await ctx.db.verificationEvent.count({
          where: { vaultId: s.vault.id, state: { in: ['Submitted', 'Confirming', 'Disputed', 'Grace'] } },
        })).toBe(0);
      }
    });

    it('the owner can start at any time', async () => {
      const s = await scene();
      expect((await start(s)).status).toBe(201);
    });
  });

  describe('owner activity after the start cancels the process (D5)', () => {
    it('a login of the owner cancels; a login of a verifier does not', async () => {
      const password = 'correct horse battery';
      const owner = await ctx.factory.createUser({ passwordHash: await hashPassword(password) });
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2, heartbeatTimeoutDays: 0 });
      const v1 = await ctx.factory.createVerifier(vault.id, { email: 'v1@login.test' });
      await ctx.db.user.update({ where: { id: v1.user.id }, data: { passwordHash: await hashPassword(password) } });
      await ctx.factory.createVerifier(vault.id);
      const s = { owner, vault } as unknown as S;

      expect((await start(s, v1.user.id)).status).toBe(201);
      const vLogin = await ctx.request('POST', '/auth/login', { email: 'v1@login.test', password });
      expect(vLogin.status).toBe(201);
      expect((await event(s)).state).toBe('Submitted');

      const oLogin = await ctx.request('POST', '/auth/login', { email: owner.email, password });
      expect(oLogin.status).toBe(201);
      const ev = await event(s);
      expect(ev).toMatchObject({ state: 'Cancelled', cancelledBy: owner.id });
      expect((await ctx.db.user.findUniqueOrThrow({ where: { id: owner.id } })).lastLoginAt).not.toBeNull();
      expect(await vaultStatus(s)).toBe('Active');
    });

    it('a heartbeat ping of the owner cancels, even during grace', async () => {
      const s = await scene();
      await toGrace(s);
      const ping = await ctx.request('POST', '/heartbeats/ping', { vault_id: s.vault.id }, s.owner.id);
      expect(ping.status).toBe(201);
      expect((await event(s)).state).toBe('Cancelled');
      expect(await svc().processTimers(at(2 * D))).toEqual({ finalized: 0, rejected: 0 });
    });
  });

  describe('policy snapshot and frozen settings (D4)', () => {
    it('settings, heartbeat threshold and the verifier composition cannot change while a process is active', async () => {
      const s = await scene();
      await start(s);
      expect((await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { quorum_threshold: 3 }, s.owner.id)).status).toBe(409);
      expect((await ctx.request('PATCH', `/vaults/${s.vault.id}/heartbeat`, { timeout_days: 5 }, s.owner.id)).status).toBe(409);
      expect((await ctx.request('POST', '/verifiers/invitations', { vault_id: s.vault.id, email: 'late@test.local' }, s.owner.id)).status).toBe(409);
      expect((await ctx.request('POST', `/verifiers/${s.vault.id}/${s.v1.user.id}/revoke`, undefined, s.owner.id)).status).toBe(409);

      await cancel(s);
      expect((await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { quorum_threshold: 3 }, s.owner.id)).status).toBe(200);
      expect((await ctx.request('POST', `/verifiers/${s.vault.id}/${s.v1.user.id}/revoke`, undefined, s.owner.id)).status).toBe(201);
    });

    it('an invitation issued before the start cannot be accepted during the process, and is not burned', async () => {
      const s = await scene();
      const invitee = await ctx.factory.createUser({ email: 'pending.invitee@test.local' });
      expect((await ctx.request('POST', '/verifiers/invitations', { vault_id: s.vault.id, email: invitee.email }, s.owner.id)).status).toBe(201);
      const token = (await ctx.invitationTokens(invitee.email))[0];

      await start(s);
      const during = await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id);
      expect(during.status).toBe(409);
      expect(await ctx.db.vaultUserRole.count({ where: { vaultId: s.vault.id, userId: invitee.id } })).toBe(0);
      expect((await ctx.db.vaultUserInvitation.findFirstOrThrow({ where: { email: invitee.email } })).acceptedAt).toBeNull();

      await cancel(s);
      expect((await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id)).status).toBe(201);
    });

    it('the quorum, the grace length and the participants are fixed at the start, even if the data changes underneath', async () => {
      const s = await scene();
      await start(s);
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { quorumThreshold: 1 } });
      const late = await ctx.factory.createVerifier(s.vault.id); // стал активным верификатором уже после старта
      expect((await vote(s, late.user.id, 'Confirm')).status).toBe(403);

      const one = await vote(s, s.v1.user.id, 'Confirm');
      expect(one.body).toMatchObject({ state: 'Confirming', quorum: 2 }); // кворум остался 2

      // голос отозванного участника не учитывается: вторая «подтверждающая» запись не создаёт кворум
      await ctx.db.vaultUserRole.update({ where: { vaultId_userId: { vaultId: s.vault.id, userId: s.v1.user.id } }, data: { status: 'Revoked' } });
      const two = await vote(s, s.v2.user.id, 'Confirm');
      expect(two.body).toMatchObject({ state: 'Confirming', confirms: 1 });
    });
  });

  describe('durable timers, restarts and several workers', () => {
    it('a freshly created service instance finishes the event from the database state alone', async () => {
      const s = await scene();
      await toGrace(s);
      const fresh = new OrchestratorService(
        ctx.moduleRef.get(PrismaService),
        ctx.moduleRef.get(NotificationsService),
        ctx.moduleRef.get(AuditService),
        ctx.moduleRef.get(VaultAccessService),
        ctx.clock,
      );
      expect(await fresh.processTimers(at(25 * H))).toEqual({ finalized: 1, rejected: 0 });
      expect((await event(s)).state).toBe('Finalized');
    });

    it('two workers sweeping at once finalize once', async () => {
      const s = await scene();
      await toGrace(s);
      const [a, b] = await Promise.all([svc().processTimers(at(25 * H)), svc().processTimers(at(25 * H))]);
      expect(a.finalized + b.finalized).toBe(1);
      expect(await ctx.db.auditLog.count({ where: { action: 'event_finalized' } })).toBe(1);
      expect(await mails('AfterLight: процесс завершён')).toBe(4);
    });

    it('a failure while queueing the notification rolls the transition back; a retry succeeds without duplicates', async () => {
      const s = await scene();
      await toGrace(s);
      const notify = ctx.moduleRef.get(NotificationsService);
      const spy = jest.spyOn(notify, 'enqueueEmail').mockRejectedValueOnce(new Error('mail queue is down'));

      expect(await svc().processTimers(at(25 * H))).toEqual({ finalized: 0, rejected: 0 });
      expect((await event(s)).state).toBe('Grace'); // переход откатился целиком
      expect(await vaultStatus(s)).toBe('PendingGrace');
      expect(await ctx.db.auditLog.count({ where: { action: 'event_finalized' } })).toBe(0);
      expect(await mails('AfterLight: процесс завершён')).toBe(0);

      spy.mockRestore();
      expect(await svc().processTimers(at(25 * H))).toEqual({ finalized: 1, rejected: 0 });
      expect(await mails('AfterLight: процесс завершён')).toBe(4);
      expect(await ctx.db.auditLog.count({ where: { action: 'event_finalized' } })).toBe(1);
    });
  });

  describe('API safety', () => {
    it('does not expose a way to move time in production code paths', async () => {
      const res = await ctx.request('POST', '/clock/advance', { ms: 1 }, (await ctx.factory.createUser()).id);
      expect(res.status).toBe(404);
    });
  });
});
