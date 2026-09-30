import { OrchestratorService } from '../src/orchestrator/orchestrator.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

/** Голоса считаются только у активных верификаторов сейфа: findMany ролей + findMany решений. */
function mockVotes(prisma: any, confirms: number, denies: number, emails: string[] = []) {
  const decisions = [
    ...Array.from({ length: confirms }, (_, i) => ({ userId: `c${i}`, decision: 'Confirm' })),
    ...Array.from({ length: denies }, (_, i) => ({ userId: `d${i}`, decision: 'Deny' })),
  ];
  prisma.vaultUserRole.findMany.mockImplementation(async (args: any) =>
    args?.where?.role === 'Verifier'
      ? decisions.map((d) => ({ userId: d.userId }))
      : emails.map((email) => ({ user: { email } })));
  prisma.verificationDecision.findMany.mockResolvedValue(decisions);
}

describe('OrchestratorService transitions', () => {
  let prisma: any;
  let notify: any;
  let audit: any;
  let access: any;
  let service: OrchestratorService;

  beforeEach(() => {
    prisma = {
      verificationEvent: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      verificationDecision: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      vault: { update: jest.fn(), findUnique: jest.fn() },
      vaultUserRole: { findMany: jest.fn(), findFirst: jest.fn() },
      user: { findUnique: jest.fn() },
      notification: { create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    } as any;
    notify = {
      enqueueEmail: jest.fn(async () => {}),
      flushEmailQueue: jest.fn(async () => {}),
    } as any;
    audit = { log: jest.fn() };
    access = { assertActiveVerifier: jest.fn(), assertManager: jest.fn() };
    service = new OrchestratorService(prisma, notify, audit, access);
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
    mockVotes(prisma, 1, 1);
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
    mockVotes(prisma, 2, 0, ['ver@example.com']);
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });

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
    mockVotes(prisma, 0, 0);
    prisma.user.findUnique.mockResolvedValue({ email: 'owner@example.com' });

    const res = await (service as any).recomputeAndTransition('e1', new Date());

    expect(res.state).toBe('Finalized');
    expect(prisma.verificationEvent.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { state: 'Finalized' } });
    expect(notify.enqueueEmail).toHaveBeenCalledWith('v1', 'owner@example.com', expect.objectContaining({ subject: 'AfterLight: процесс завершён' }));
  });

  it('does not count decisions of users who are no longer active verifiers', async () => {
    prisma.verificationEvent.findUnique.mockResolvedValue({
      id: 'e1', vaultId: 'v1', state: 'Submitted', quorumRequired: 2, createdAt: new Date(),
      vault: { userId: 'u1', quorumThreshold: 2, graceHours: 24 },
    });
    // активен один верификатор (a1); голос второго (gone) принадлежит отозванному
    prisma.vaultUserRole.findMany.mockResolvedValue([{ userId: 'a1' }]);
    prisma.verificationDecision.findMany.mockImplementation(async (args: any) => {
      expect(args.where.userId).toEqual({ in: ['a1'] });
      return [{ userId: 'a1', decision: 'Confirm' }];
    });

    const res = await (service as any).recomputeAndTransition('e1', new Date());

    expect(res).toEqual({ state: 'Confirming', confirms: 1, denies: 0, quorum: 2 });
  });

  it('decide() takes the author from the caller and requires an active verifier', async () => {
    access.assertActiveVerifier.mockRejectedValue(new Error('denied'));
    await expect(service.decide('intruder', 'v1', 'Confirm')).rejects.toThrow('denied');
    expect(access.assertActiveVerifier).toHaveBeenCalledWith('intruder', 'v1');
    expect(prisma.verificationDecision.create).not.toHaveBeenCalled();
  });
});
