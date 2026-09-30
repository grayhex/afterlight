import { NotificationsService } from '../../src/notifications/notifications.service';
import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Logger } from '@nestjs/common';

describe('NotificationsService', () => {
  let prisma: any;
  let service: NotificationsService;

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    } as any;
    service = new NotificationsService(prisma);
  });

  it('enqueues email', async () => {
    await service.enqueueEmail('v1', 'to@example.com', { subject: 'Subj' });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        vault: { connect: { id: 'v1' } },
        toContact: 'to@example.com',
        channel: 'email',
        payload: { subject: 'Subj' },
        state: 'Queued',
      },
    });
  });

  it('flushes queued emails', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 'n1', toContact: 'a', payload: {} },
      { id: 'n2', toContact: 'b', payload: {} },
    ]);
    const count = await service.flushEmailQueue();
    expect(count).toBe(2);
    expect(prisma.notification.update).toHaveBeenCalledTimes(2);
  });

  it('sends verifier invitation via email', async () => {
    const enqueueSpy = jest.spyOn(service, 'enqueueEmail').mockResolvedValue();
    const flushSpy = jest.spyOn(service, 'flushEmailQueue').mockResolvedValue(1);
    await service.sendVerifierInvitation('v1', 'to@example.com', 'tok');
    expect(enqueueSpy).toHaveBeenCalledWith('v1', 'to@example.com', expect.objectContaining({ subject: expect.any(String) }));
    expect(flushSpy).toHaveBeenCalled();
  });

  describe('logs', () => {
    afterEach(() => { jest.restoreAllMocks(); });

    it('never log the email body, which may carry one-time tokens', async () => {
      const lines: string[] = [];
      jest.spyOn(Logger.prototype, 'log').mockImplementation((m: any) => { lines.push(String(m)); });
      prisma.notification.findMany.mockResolvedValue([
        { id: 'n1', toContact: 'a@example.com', payload: { subject: 'Reset', text: 'token=SECRET-TOKEN-123' } },
      ]);
      await service.flushEmailQueue();
      expect(lines.join('\n')).toContain('a@example.com');
      expect(lines.join('\n')).not.toContain('SECRET-TOKEN-123');
    });

    it('puts the invitation token into the URL fragment so it stays out of access logs', async () => {
      prisma.notification.findMany.mockResolvedValue([]);
      await service.sendVerifierInvitation('v1', 'ver@example.com', 'tok123');
      const text = (prisma.notification.create.mock.calls[0][0] as any).data.payload.text as string;
      expect(text).toContain('/invite#token=tok123');
      expect(text).not.toContain('?token=');
    });
  });
});
