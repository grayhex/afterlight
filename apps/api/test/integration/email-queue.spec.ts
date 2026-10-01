import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createHash } from 'crypto';
import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

/** Очередь email на настоящем PostgreSQL и настоящем SMTP-сервере (sandbox): доставка, отказы, повторы, воркеры. */
describe('email queue (real PostgreSQL, real SMTP sandbox)', () => {
  let ctx: Ctx;
  let t0: Date;
  const svc = () => ctx.moduleRef.get(NotificationsService);
  const secs = (n: number) => new Date(t0.getTime() + n * 1000);
  const rows = () => ctx.db.notification.findMany({ orderBy: { createdAt: 'asc' } });

  beforeEach(async () => {
    ctx = await bootstrapApp();
    t0 = new Date();
    ctx.clock.setNow(t0);
  });
  afterEach(async () => { await closeApp(ctx); });

  async function invite(email = 'invitee@test.local') {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const res = await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email }, owner.id);
    return { owner, vault, res };
  }

  it('delivers over SMTP; Sent only after the server accepted it, and the stored body (with the token) is dropped', async () => {
    const { res } = await invite();
    expect(res.status).toBe(201);

    const mails = ctx.mail.to('invitee@test.local');
    expect(mails).toHaveLength(1);
    expect(mails[0].subject).toBe('AfterLight: приглашение доверителя');
    const token = mails[0].text.match(/#token=([A-Za-z0-9_-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(mails[0].text).not.toMatch(/example\.(com|org|net)/);

    const [n] = await rows();
    expect(n).toMatchObject({ state: 'Sent', attempts: 1, lastError: null, lockedUntil: null });
    expect(n.sentAt).toBeTruthy();
    expect(JSON.stringify(n.payload)).not.toContain(token as string);
    expect(n.payload).toEqual({ subject: 'AfterLight: приглашение доверителя', redacted: true });
  });

  it('mail down: the request still succeeds, the task is kept with a diagnosable error, never Sent; recovery sends it once', async () => {
    await ctx.mail.stop();
    const { res, vault } = await invite();
    expect(res.status).toBe(201); // доменная операция не зависит от доставки

    const [pending] = await rows();
    expect(pending).toMatchObject({ state: 'Queued', attempts: 1, sentAt: null });
    expect(pending.lastError).toMatch(/^(ESOCKET|ECONNECTION|ECONNREFUSED|ETIMEDOUT)/);
    expect(pending.nextAttemptAt.getTime()).toBe(secs(30).getTime()); // первый повтор через base=30 c
    expect(ctx.mail.messages).toHaveLength(0);

    // срок не наступил — задача не берётся
    expect((await svc().dispatchDue()).claimed).toBe(0);

    await ctx.mail.start(); // почта вернулась
    ctx.clock.setNow(secs(31));
    expect(await svc().dispatchDue()).toMatchObject({ claimed: 1, sent: 1 });

    expect(ctx.mail.to('invitee@test.local')).toHaveLength(1);
    expect((await rows())[0]).toMatchObject({ state: 'Sent', attempts: 2, lastError: null });
    // доставка не повторяла доменную операцию: одно приглашение и одна запись аудита
    expect(await ctx.db.vaultUserInvitation.count({ where: { vaultId: vault.id } })).toBe(1);
    expect(await ctx.db.auditLog.count({ where: { action: 'verifier_invite' } })).toBe(1);

    // повторный проход не отправляет письмо второй раз
    ctx.clock.setNow(secs(3600));
    expect((await svc().dispatchDue()).claimed).toBe(0);
    expect(ctx.mail.to('invitee@test.local')).toHaveLength(1);
  });

  it('retries with exponential backoff and gives up with Failed and the last error after MAIL_MAX_ATTEMPTS', async () => {
    ctx.mail.mode = 'reject-temporary';
    await invite();
    const delays: number[] = [];
    let now = 0;
    for (let attempt = 1; attempt < 4; attempt++) {
      const n = (await rows())[0];
      expect(n).toMatchObject({ state: 'Queued', attempts: attempt });
      delays.push((n.nextAttemptAt.getTime() - secs(now).getTime()) / 1000);
      now = (n.nextAttemptAt.getTime() - t0.getTime()) / 1000;
      ctx.clock.setNow(secs(now));
      await svc().dispatchDue();
    }
    expect(delays).toEqual([30, 60, 120]);

    const failed = (await rows())[0];
    expect(failed).toMatchObject({ state: 'Failed', attempts: 4, sentAt: null });
    expect(failed.lastError).toContain('451');
    expect(failed.payload).toEqual({ redacted: true });
    ctx.clock.setNow(secs(100000));
    expect((await svc().dispatchDue()).claimed).toBe(0); // Failed больше не берётся
    expect(ctx.mail.messages).toHaveLength(0);
  });

  it('a permanent rejection (5xx) fails at once without pointless retries', async () => {
    ctx.mail.mode = 'reject-permanent';
    await invite();
    expect((await rows())[0]).toMatchObject({ state: 'Failed', attempts: 1 });
    expect((await rows())[0].lastError).toContain('550');
  });

  it('two workers take disjoint sets: every message is delivered exactly once', async () => {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id);
    await ctx.mail.stop(); // накапливаем очередь, пока почты нет
    for (let i = 0; i < 12; i++) await svc().enqueueEmail(vault.id, `rcpt${i}@test.local`, { subject: `S${i}`, text: 'x' });
    await ctx.mail.start();

    const [a, b] = await Promise.all([svc().dispatchDue(6), svc().dispatchDue(6)]);
    expect(a.claimed + b.claimed).toBe(12);
    expect(a.sent + b.sent).toBe(12);
    const delivered = ctx.mail.messages.flatMap((m) => m.to).sort();
    expect(delivered).toEqual(Array.from({ length: 12 }, (_, i) => `rcpt${i}@test.local`).sort());
    expect(new Set(delivered).size).toBe(12);
  });

  it('a task claimed by a crashed worker returns to the queue once its lease expires, and not earlier', async () => {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id);
    await svc().enqueueEmail(vault.id, 'lease@test.local', { subject: 'Lease', text: 'x' }); // не отправлено: dispatch не вызывали
    await ctx.db.notification.updateMany({ data: { attempts: 1, lockedUntil: secs(120) } }); // воркер взял и «упал»

    ctx.clock.setNow(secs(60));
    expect((await svc().dispatchDue()).claimed).toBe(0);
    ctx.clock.setNow(secs(121));
    expect(await svc().dispatchDue()).toMatchObject({ claimed: 1, sent: 1 });
    expect(ctx.mail.to('lease@test.local')).toHaveLength(1);
    expect((await rows())[0]).toMatchObject({ state: 'Sent', attempts: 2 });
  });

  it('a rolled-back domain change leaves no mail in the queue (the intent is written in the same transaction)', async () => {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id);
    await expect(ctx.db.$transaction(async (tx) => {
      await svc().enqueueEmail(vault.id, 'rolled@test.local', { subject: 'X', text: 'x' }, tx);
      throw new Error('rollback');
    })).rejects.toThrow('rollback');
    expect(await ctx.db.notification.count()).toBe(0);
  });

  describe('mail never outlives its token and never blocks the request', () => {
    it('a newer reset request supersedes the unsent older mail: after recovery only the valid token is delivered', async () => {
      await ctx.factory.createUser({ email: 'twice@test.local' });
      await ctx.mail.stop();
      await ctx.request('POST', '/auth/forgot-password', { email: 'twice@test.local' });
      ctx.clock.setNow(secs(61)); // пауза между запросами (анти-спам) прошла
      await ctx.request('POST', '/auth/forgot-password', { email: 'twice@test.local' });
      const queued = await rows();
      expect(queued.map((r) => r.state)).toEqual(['Cancelled', 'Queued']);
      expect(queued[0].lastError).toContain('superseded');

      await ctx.mail.start();
      ctx.clock.setNow(secs(100));
      await svc().dispatchDue();
      const mails = ctx.mail.to('twice@test.local');
      expect(mails).toHaveLength(1);
      const token = mails[0].text.match(/: ([0-9a-f]{64})/)?.[1] as string;
      const stored = await ctx.db.passwordResetToken.findFirstOrThrow();
      expect(createHash('sha256').update(token).digest('hex')).toBe(stored.tokenHash); // письмо несёт действующий токен
    });

    it('a reset mail still queued after its token expired is cancelled instead of sent', async () => {
      await ctx.factory.createUser({ email: 'late@test.local' });
      await ctx.mail.stop();
      await ctx.request('POST', '/auth/forgot-password', { email: 'late@test.local' });
      await ctx.mail.start();
      ctx.clock.setNow(secs(61 * 60)); // токен жил час
      expect(await svc().dispatchDue()).toMatchObject({ claimed: 0, sent: 0 });
      expect(ctx.mail.to('late@test.local')).toHaveLength(0);
      expect((await rows())[0]).toMatchObject({ state: 'Cancelled', lastError: 'expired before delivery' });
    });

    it('an invitation mail is cancelled once the invitation itself has expired', async () => {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      await ctx.mail.stop();
      const res = await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email: 'short@test.local', expires_in_hours: 1 }, owner.id);
      expect(res.status).toBe(201);
      await ctx.mail.start();
      ctx.clock.setNow(secs(2 * 3600));
      await svc().dispatchDue();
      expect(ctx.mail.to('short@test.local')).toHaveLength(0);
      expect((await rows())[0].state).toBe('Cancelled');
    });

    it('overlapping reset requests are serialized: exactly one token and one mail result', async () => {
      await ctx.factory.createUser({ email: 'burst@test.local' });
      await ctx.mail.stop();
      const results = await Promise.all(Array.from({ length: 6 }, () => ctx.request('POST', '/auth/forgot-password', { email: 'burst@test.local' })));
      expect(results.every((r) => r.status === 201)).toBe(true);
      expect(await ctx.db.passwordResetToken.count()).toBe(1);
      expect(await ctx.db.notification.count()).toBe(1);

      await ctx.mail.start();
      ctx.clock.setNow(secs(31));
      await svc().dispatchDue();
      const mails = ctx.mail.to('burst@test.local');
      expect(mails).toHaveLength(1);
      const token = mails[0].text.match(/: ([0-9a-f]{64})/)?.[1] as string;
      expect(createHash('sha256').update(token).digest('hex')).toBe((await ctx.db.passwordResetToken.findFirstOrThrow()).tokenHash);
    });

    it('anti-spam: a cooldown between reset mails and an hourly cap per address; the API answer never changes', async () => {
      await ctx.factory.createUser({ email: 'spam@test.local' });
      const ask = () => ctx.request('POST', '/auth/forgot-password', { email: 'spam@test.local' });
      const first = await ask();
      const tooSoon = await ask();
      expect(tooSoon.status).toBe(first.status);
      expect(tooSoon.body).toEqual(first.body);
      expect(ctx.mail.to('spam@test.local')).toHaveLength(1); // вторая просьба в паузе писем не породила

      for (let i = 1; i <= 4; i++) {
        ctx.clock.setNow(secs(61 * i));
        await ask();
      }
      expect(ctx.mail.to('spam@test.local')).toHaveLength(5);
      ctx.clock.setNow(secs(61 * 5));
      await ask(); // потолок 5 писем в час исчерпан
      expect(ctx.mail.to('spam@test.local')).toHaveLength(5);

      ctx.clock.setNow(secs(3600 + 400));
      await ask(); // час прошёл
      expect(ctx.mail.to('spam@test.local')).toHaveLength(6);
    });

    it('a reset token consumed before a retry cancels the pending mail: a known-invalid token is never sent', async () => {
      await ctx.factory.createUser({ email: 'consumed@test.local' });
      await ctx.mail.stop();
      await ctx.request('POST', '/auth/forgot-password', { email: 'consumed@test.local' });
      const [queued] = await rows();
      const token = (queued.payload as any).text.match(/: ([0-9a-f]{64})/)[1] as string; // письмо «ушло, но подтверждение потерялось»
      expect((await ctx.request('POST', '/auth/reset-password', { token, password: 'new-password-1' })).status).toBe(201);
      expect((await rows())[0]).toMatchObject({ state: 'Cancelled', lastError: 'token consumed' });

      await ctx.mail.start();
      ctx.clock.setNow(secs(31));
      await svc().dispatchDue();
      expect(ctx.mail.to('consumed@test.local')).toHaveLength(0);
    });

    it('an accepted invitation cancels its pending mail the same way', async () => {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      const invitee = await ctx.factory.createUser({ email: 'accepted@test.local' });
      await ctx.mail.stop();
      await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email: 'accepted@test.local' }, owner.id);
      const [queued] = await rows();
      const token = (queued.payload as any).text.match(/#token=([A-Za-z0-9_-]+)/)[1] as string;
      expect((await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id)).status).toBe(201);
      expect((await rows())[0]).toMatchObject({ state: 'Cancelled', lastError: 'invitation accepted' });

      await ctx.mail.start();
      ctx.clock.setNow(secs(31));
      await svc().dispatchDue();
      expect(ctx.mail.to('accepted@test.local')).toHaveLength(0);
    });

    it('stored diagnostics are normalized codes: server text that echoes a token or address never reaches last_error', async () => {
      ctx.mail.mode = 'reject-permanent';
      ctx.mail.rejectText = 'SECRET-ECHO-TOKEN person@mail.test body excerpt';
      await ctx.factory.createUser({ email: 'echo@test.local' });
      await ctx.request('POST', '/auth/forgot-password', { email: 'echo@test.local' });
      const [n] = await rows();
      expect(n.state).toBe('Failed');
      expect(n.lastError).toMatch(/^SMTP 550/);
      expect(n.lastError).not.toContain('SECRET-ECHO-TOKEN');
      expect(n.lastError).not.toContain('person@mail.test');
    });

    it('revoking an invitation before the mail went out cancels the mail: the revoked token never reaches the addressee', async () => {
      const owner = await ctx.factory.createUser();
      const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
      await ctx.mail.stop();
      const created = await ctx.request('POST', '/verifiers/invitations', { vault_id: vault.id, email: 'revoked@test.local' }, owner.id);
      expect(created.status).toBe(201);
      expect((await rows())[0]).toMatchObject({ state: 'Queued', kind: 'verifier_invitation', supersedeKey: created.body.id });

      expect((await ctx.request('DELETE', `/verifiers/invitations/${created.body.id}`, undefined, owner.id)).status).toBe(200);
      expect((await rows())[0]).toMatchObject({ state: 'Cancelled', lastError: 'invitation revoked' });

      await ctx.mail.start();
      ctx.clock.setNow(secs(31));
      await svc().dispatchDue();
      expect(ctx.mail.to('revoked@test.local')).toHaveLength(0);
    });

    it('a stalled SMTP server does not hold the HTTP request; the task stays queued with a timeout error', async () => {
      await ctx.factory.createUser({ email: 'stall@test.local' });
      ctx.mail.mode = 'stall';
      const started = Date.now();
      const res = await fetch(`${ctx.baseUrl}/auth/forgot-password`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'stall@test.local' }),
      });
      const took = Date.now() - started;
      expect(res.status).toBe(201);
      expect(took).toBeLessThan(900); // SMTP-таймаут в тестах 1000 мс: запрос его не ждёт

      await svc().idle(); // фоновая отправка упирается в дедлайн
      const [n] = await rows();
      expect(n).toMatchObject({ state: 'Queued', attempts: 1 });
      expect(n.lastError).toMatch(/ETIMEDOUT|ECONNECTION|timeout/i);
      expect(ctx.mail.messages).toHaveLength(0);
    });
  });

  describe('account recovery works without a vault', () => {
    it('a user without any vault gets the reset mail, the token is single-use, and an unknown address learns nothing', async () => {
      const user = await ctx.factory.createUser({ email: 'novault@test.local' });
      expect(await ctx.db.vault.count({ where: { userId: user.id } })).toBe(0);

      const known = await ctx.request('POST', '/auth/forgot-password', { email: 'novault@test.local' });
      const unknown = await ctx.request('POST', '/auth/forgot-password', { email: 'nobody@test.local' });
      expect(known.status).toBe(unknown.status);
      expect(known.body).toEqual(unknown.body);
      expect(ctx.mail.to('nobody@test.local')).toHaveLength(0);

      const mails = ctx.mail.to('novault@test.local');
      expect(mails).toHaveLength(1);
      const token = mails[0].text.match(/: ([0-9a-f]{64})/)?.[1] as string;
      expect(token).toBeTruthy();
      expect(mails[0].text).toContain('ключи шифрования по почте не восстанавливаются');

      expect((await ctx.request('POST', '/auth/reset-password', { token: 'f'.repeat(64), password: 'new-password-1' })).status).toBe(401);
      expect((await ctx.request('POST', '/auth/reset-password', { token, password: 'new-password-1' })).status).toBe(201);
      expect((await ctx.request('POST', '/auth/reset-password', { token, password: 'new-password-2' })).status).toBe(401);
      expect((await ctx.request('POST', '/auth/login', { email: 'novault@test.local', password: 'new-password-1' })).status).toBe(201);

      const n = (await rows()).find((r) => r.toContact === 'novault@test.local');
      expect(n).toMatchObject({ vaultId: null, state: 'Sent' });
      expect(JSON.stringify(n!.payload)).not.toContain(token);
    });

    it('with the mail down the reset request still succeeds and the token mail is delivered later, once', async () => {
      await ctx.factory.createUser({ email: 'outage@test.local' });
      await ctx.mail.stop();
      expect((await ctx.request('POST', '/auth/forgot-password', { email: 'outage@test.local' })).status).toBe(201);
      expect((await rows())[0]).toMatchObject({ state: 'Queued', vaultId: null });

      await ctx.mail.start();
      ctx.clock.setNow(secs(31));
      await svc().dispatchDue();
      expect(ctx.mail.to('outage@test.local')).toHaveLength(1);
      expect(await ctx.db.passwordResetToken.count()).toBe(1); // токен один, повторное письмо новый не создаёт
    });
  });
});
