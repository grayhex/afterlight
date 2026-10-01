import { NotificationsService } from '../../src/notifications/notifications.service.js';
import { MailSendError } from '../../src/notifications/mail-transport.js';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

describe('NotificationsService', () => {
  let prisma: any;
  let transport: any;
  let clock: any;
  let service: NotificationsService;
  const now = new Date('2026-10-01T10:00:00.000Z');

  const row = (over: Record<string, unknown> = {}) => ({
    id: 'n1', toContact: 'person@mail.test', payload: { subject: 'Reset', text: 'token=SECRET-TOKEN-123' }, attempts: 1,
    lockedUntil: new Date(now.getTime() + 60_000), expiresAt: null as Date | null, ...over,
  });

  beforeEach(() => {
    prisma = {
      notification: { create: jest.fn(async () => ({ id: 'n1' })), updateMany: jest.fn(async () => ({ count: 1 })), findMany: jest.fn(), findFirst: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    transport = { send: jest.fn(async () => undefined) };
    clock = { now: () => now };
    service = new NotificationsService(prisma, transport, clock);
  });
  afterEach(() => { jest.restoreAllMocks(); });

  /** Последнее изменение состояния задачи (без служебного снятия аренды release). */
  const outcome = () => prisma.notification.updateMany.mock.calls.filter((c: any[]) => c[0].where.state !== undefined && c[0].where.state.not === undefined).at(-1)[0];

  function claimOne(r = row()) {
    prisma.$queryRaw.mockResolvedValue([{ id: r.id }]);
    prisma.notification.findMany.mockResolvedValue([r]);
    prisma.notification.findFirst.mockResolvedValue({ payload: r.payload }); // перечитывание перед отправкой: ещё Queued
  }

  it('enqueues with a nullable vault and the due time = now', async () => {
    await service.enqueueEmail(null, 'to@mail.test', { subject: 'Subj' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: { vaultId: null, toContact: 'to@mail.test', channel: 'email', payload: { subject: 'Subj' }, state: 'Queued', nextAttemptAt: now },
      select: { id: true },
    });
  });

  it('writes the intent through the caller transaction when one is given', async () => {
    const tx = { notification: { create: jest.fn(async () => ({ id: 'n2' })) } };
    await service.enqueueEmail('v1', 'to@mail.test', { subject: 'S' }, tx as any);
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('marks Sent only after the transport confirmed, and drops the stored body', async () => {
    claimOne();
    const res = await service.dispatchDue();
    expect(res).toEqual({ claimed: 1, sent: 1, retried: 0, failed: 0 });
    expect(transport.send).toHaveBeenCalledWith({ to: 'person@mail.test', subject: 'Reset', text: 'token=SECRET-TOKEN-123', html: undefined });
    const data = outcome().data;
    expect(data).toMatchObject({ state: 'Sent', payload: { subject: 'Reset', redacted: true } });
  });

  it('an ambiguous/network failure is never Sent: the task is rescheduled with backoff and a diagnosable error', async () => {
    claimOne(row({ attempts: 3 }));
    transport.send.mockRejectedValue(new MailSendError('ETIMEDOUT: connection timed out', false, 'ETIMEDOUT'));
    const res = await service.dispatchDue();
    expect(res).toMatchObject({ sent: 0, retried: 1, failed: 0 });
    const data = outcome().data;
    expect(data.state).toBeUndefined();
    expect(data.lastError).toBe('ETIMEDOUT: connection timed out');
    expect(data.nextAttemptAt).toEqual(new Date(now.getTime() + 120 * 1000)); // 30 * 2^(3-1)
  });

  it('a permanent rejection fails at once; a non-MailSendError is treated as transient', async () => {
    claimOne();
    transport.send.mockRejectedValue(new MailSendError('550: no such user', true, 'EENVELOPE'));
    expect(await service.dispatchDue()).toMatchObject({ failed: 1, retried: 0 });
    expect(outcome().data).toMatchObject({ state: 'Failed', payload: { redacted: true } });

    claimOne();
    transport.send.mockRejectedValue(new Error('boom'));
    expect(await service.dispatchDue()).toMatchObject({ failed: 0, retried: 1 });
  });

  it('logs neither the body/token nor the full address', async () => {
    const lines: string[] = [];
    const sink = (m: any) => { lines.push(String(m)); };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(sink);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(sink);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(sink);
    await service.enqueueEmail(null, 'person@mail.test', { subject: 'Reset', text: 'token=SECRET-TOKEN-123' });
    claimOne();
    transport.send.mockRejectedValue(new MailSendError('451: try later', false));
    await service.dispatchDue();
    claimOne();
    transport.send.mockResolvedValue(undefined);
    await service.dispatchDue();
    const all = lines.join('\n');
    expect(all).not.toContain('SECRET-TOKEN-123');
    expect(all).not.toContain('person@mail.test');
    expect(all).toContain('p***@mail.test');
  });

  it('re-reads the state right before sending: a task cancelled while waiting in the claimed batch is not sent', async () => {
    claimOne();
    prisma.notification.findFirst.mockResolvedValue(null); // тем временем снято (Cancelled)
    const res = await service.dispatchDue();
    expect(transport.send).not.toHaveBeenCalled();
    expect(res).toMatchObject({ claimed: 1, sent: 0, retried: 0, failed: 0 });
  });

  it('dispatchSoon returns at once (never waits for SMTP) and swallows queue errors', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    expect(service.dispatchSoon()).toBeUndefined();
    await expect(service.idle()).resolves.toBeUndefined();
  });

  it('a burst of wake-ups is coalesced: one pass at a time plus one follow-up, not one pass per call', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const spy = jest.spyOn(service, 'dispatchDue').mockImplementation(async () => { await gate; return { claimed: 0, sent: 0, retried: 0, failed: 0 }; });
    for (let i = 0; i < 25; i++) service.dispatchSoon();
    expect(spy).toHaveBeenCalledTimes(1);
    release();
    await service.idle();
    expect(spy).toHaveBeenCalledTimes(2); // повтор, о котором попросили во время прохода
    service.dispatchSoon();
    await service.idle();
    expect(spy).toHaveBeenCalledTimes(3); // после простоя новый проход запускается как обычно
  });

  it('a stalled SMTP server is cut off by a hard per-message deadline and counted as a transient failure', async () => {
    process.env.MAIL_SEND_TIMEOUT_MS = '1000';
    try {
      service = new NotificationsService(prisma, transport, clock);
    } finally {
      delete process.env.MAIL_SEND_TIMEOUT_MS;
    }
    claimOne(row({ lockedUntil: new Date(now.getTime() + 600_000) }));
    transport.send.mockImplementation(() => new Promise(() => undefined)); // никогда не отвечает
    const started = Date.now();
    const res = await service.dispatchDue();
    expect(Date.now() - started).toBeLessThan(3000);
    expect(res).toMatchObject({ sent: 0, retried: 1 });
    expect(outcome().data.lastError).toContain('ETIMEDOUT');
  });

  it('sizes the lease for the whole claimed batch (send timeout x batch size + margin)', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    prisma.notification.findMany.mockResolvedValue([]);
    await service.dispatchDue();
    const lease = prisma.notification.updateMany.mock.calls.find((c: any[]) => c[0].data.attempts)[0].data.lockedUntil as Date;
    expect(lease.getTime()).toBe(now.getTime() + 15_000 * 3 + 30_000);
  });

  it('does not send a task whose lease already ran out (another worker may own it) or whose token has expired', async () => {
    prisma.$queryRaw.mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]);
    prisma.notification.findMany.mockResolvedValue([
      row({ id: 'n1', lockedUntil: new Date(now.getTime() - 1) }),
      row({ id: 'n2', expiresAt: new Date(now.getTime() - 1) }),
    ]);
    const res = await service.dispatchDue();
    expect(res.sent).toBe(0);
    expect(transport.send).not.toHaveBeenCalled();
    const cancels = prisma.notification.updateMany.mock.calls.filter((c: any[]) => c[0].data.state === 'Cancelled');
    expect(cancels.some((c: any[]) => c[0].where.id === 'n2')).toBe(true);
  });

  it('every pass first cancels queued mail whose expiry has passed', async () => {
    prisma.$queryRaw.mockResolvedValue([]);
    await service.dispatchDue();
    expect(prisma.notification.updateMany.mock.calls[0][0]).toMatchObject({
      where: { state: 'Queued', expiresAt: { lte: now } },
      data: { state: 'Cancelled', lastError: 'expired before delivery' },
    });
  });

  it('a new password-reset mail supersedes the unsent previous ones of the same user, inside the caller transaction', async () => {
    const tx: any = { notification: { updateMany: jest.fn(async () => ({ count: 1 })), create: jest.fn(async (_args: any) => ({ id: 'n9' })) } };
    const expiresAt = new Date(now.getTime() + 3600_000);
    await service.sendPasswordReset('person@mail.test', 'tok', 'user-1', expiresAt, tx as any);
    expect(tx.notification.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { kind: 'password_reset', supersedeKey: 'user-1', state: 'Queued' },
      data: expect.objectContaining({ state: 'Cancelled' }),
    }));
    expect(tx.notification.create.mock.calls[0][0].data).toMatchObject({ kind: 'password_reset', supersedeKey: 'user-1', expiresAt, vaultId: null });
    expect(prisma.notification.create).not.toHaveBeenCalled();
  });

  it('verifier invitation carries the token in the fragment and never an example.* domain', async () => {
    const enqueue = jest.spyOn(service, 'enqueueEmail').mockResolvedValue();
    process.env.WEB_BASE_URL = 'https://afterlight.mail.test/';
    await service.enqueueVerifierInvitation('v1', 'to@mail.test', 'tok', new Date(now.getTime() + 1000), 'inv-1', {} as any);
    const payload: any = enqueue.mock.calls[0][2];
    expect(enqueue.mock.calls[0][4]).toMatchObject({ kind: 'verifier_invitation', supersedeKey: 'inv-1' });
    expect(payload.text).toContain('https://afterlight.mail.test/invite#token=tok');
    expect(payload.text).not.toMatch(/example\.(com|org|net)/);
    delete process.env.WEB_BASE_URL;
  });
});
