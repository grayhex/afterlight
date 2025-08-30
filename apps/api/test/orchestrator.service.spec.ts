import { OrchestratorService } from '../src/orchestrator/orchestrator.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('OrchestratorService transitions', () => {
  let prisma: any;
  let notify: any;
  let audit: any;
  let service: OrchestratorService;

  beforeEach(() => {
    prisma = {
      verificationEvent: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      verificationDecision: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      vault: { update: jest.fn(), findUnique: jest.fn() },
      vaultVerifier: { findMany: jest.fn(), findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      notification: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    } as any;
    notify = {
      enqueueEmail: jest.fn(async () => {}),
      flushEmailQueue: jest.fn(async () => {}),
    } as any;
    audit = { log: jest.fn() };
    service = new OrchestratorService(prisma, notify, audit);
  });

  it('transitions to Disputed when confirmations conflict', async () => {
    prisma.verificationEvent.findUnique.mockResolvedValue({
      id: 'e1',
      vaultId: 'v1',
      state: 'Submitted',
      quorumRequired: 2,
      createdAt: new Date(),
      vault: { userId: 'u1', quorumThreshold: 2, graceHours: 24 },
    });
    prisma.verificationDecision.count.mockResolvedValueOnce(1).mockResolvedValueOnce(1);
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });

    const res = await (service as any).recomputeAndTransition('e1', new Date());

    expect(res.state).toBe('Disputed');
    expect(prisma.verificationEvent.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { state: 'Disputed' } });
    expect(notify.enqueueEmail).toHaveBeenCalled();
  });

  it('transitions through QuorumReached to Grace', async () => {
    const base = { id: 'e1', vaultId: 'v1', quorumRequired: 2, createdAt: new Date(), vault: { userId: 'u1', quorumThreshold: 2, graceHours: 24 } };
    prisma.verificationEvent.findUnique
      .mockResolvedValueOnce({ ...base, state: 'Confirming' })
      .mockResolvedValueOnce({ ...base, state: 'QuorumReached' });
    prisma.verificationDecision.count
      .mockResolvedValueOnce(2).mockResolvedValueOnce(0)
      .mockResolvedValueOnce(2).mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });
    prisma.vaultVerifier.findMany.mockResolvedValue([{ verifier: { contact: 'ver@example.com' } }]);

    const first = await (service as any).recomputeAndTransition('e1', new Date());
    expect(first.state).toBe('QuorumReached');
    expect(prisma.verificationEvent.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { state: 'QuorumReached' } });

    const second = await (service as any).recomputeAndTransition('e1', new Date());
    expect(second.state).toBe('Grace');
    expect(prisma.verificationEvent.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { state: 'Grace' } });
    expect(notify.enqueueEmail).toHaveBeenCalledWith('v1', 'ver@example.com', expect.objectContaining({ subject: 'AfterLight: Grace period' }));
  });

  it('finalizes after grace period', async () => {
    const created = new Date(Date.now() - 25 * 3600 * 1000);
    prisma.verificationEvent.findUnique.mockResolvedValue({
      id: 'e1',
      vaultId: 'v1',
      state: 'Grace',
      quorumRequired: 2,
      createdAt: created,
      vault: { userId: 'u1', quorumThreshold: 2, graceHours: 24 },
    });
    prisma.verificationDecision.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });

    const res = await (service as any).recomputeAndTransition('e1', new Date());

    expect(res.state).toBe('Finalized');
    expect(prisma.verificationEvent.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { state: 'Finalized' } });
    expect(notify.enqueueEmail).toHaveBeenCalledWith('v1', 'owner@example.com', expect.objectContaining({ subject: 'AfterLight: процесс завершён' }));
  });
});
