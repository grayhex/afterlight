import { NotificationsService } from '../src/notifications/notifications.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

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
});
