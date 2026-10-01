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
    id: 'n1', toContact: 'person@mail.test', payload: { subject: 'Reset', text: 'token=SECRET-TOKEN-123' }, attempts: 1, ...over,
  });

  beforeEach(() => {
    prisma = {
      notification: { create: jest.fn(async () => ({ id: 'n1' })), updateMany: jest.fn(async () => ({ count: 1 })), findMany: jest.fn() },
      $queryRaw: jest.fn(),
    };
    prisma.$transaction = jest.fn(async (fn: any) => fn(prisma));
    transport = { send: jest.fn(async () => undefined) };
    clock = { now: () => now };
    service = new NotificationsService(prisma, transport, clock);
  });
  afterEach(() => { jest.restoreAllMocks(); });

  function claimOne(r = row()) {
    prisma.$queryRaw.mockResolvedValue([{ id: r.id }]);
    prisma.notification.findMany.mockResolvedValue([r]);
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
    const data = prisma.notification.updateMany.mock.calls.at(-1)[0].data;
    expect(data).toMatchObject({ state: 'Sent', payload: { subject: 'Reset', redacted: true } });
  });

  it('an ambiguous/network failure is never Sent: the task is rescheduled with backoff and a diagnosable error', async () => {
    claimOne(row({ attempts: 3 }));
    transport.send.mockRejectedValue(new MailSendError('ETIMEDOUT: connection timed out', false, 'ETIMEDOUT'));
    const res = await service.dispatchDue();
    expect(res).toMatchObject({ sent: 0, retried: 1, failed: 0 });
    const data = prisma.notification.updateMany.mock.calls.at(-1)[0].data;
    expect(data.state).toBeUndefined();
    expect(data.lastError).toBe('ETIMEDOUT: connection timed out');
    expect(data.nextAttemptAt).toEqual(new Date(now.getTime() + 120 * 1000)); // 30 * 2^(3-1)
  });

  it('a permanent rejection fails at once; a non-MailSendError is treated as transient', async () => {
    claimOne();
    transport.send.mockRejectedValue(new MailSendError('550: no such user', true, 'EENVELOPE'));
    expect(await service.dispatchDue()).toMatchObject({ failed: 1, retried: 0 });
    expect(prisma.notification.updateMany.mock.calls.at(-1)[0].data).toMatchObject({ state: 'Failed', payload: { redacted: true } });

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

  it('dispatchSoon swallows queue errors so the caller operation is not broken', async () => {
    prisma.$transaction.mockRejectedValue(new Error('db down'));
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    await expect(service.dispatchSoon()).resolves.toBeUndefined();
  });

  it('verifier invitation carries the token in the fragment and never an example.* domain', async () => {
    const enqueue = jest.spyOn(service, 'enqueueEmail').mockResolvedValue();
    jest.spyOn(service, 'dispatchDue').mockResolvedValue({ claimed: 0, sent: 0, retried: 0, failed: 0 });
    process.env.WEB_BASE_URL = 'https://afterlight.mail.test/';
    await service.sendVerifierInvitation('v1', 'to@mail.test', 'tok');
    const payload: any = enqueue.mock.calls[0][2];
    expect(payload.text).toContain('https://afterlight.mail.test/invite#token=tok');
    expect(payload.text).not.toMatch(/example\.(com|org|net)/);
    delete process.env.WEB_BASE_URL;
  });
});
