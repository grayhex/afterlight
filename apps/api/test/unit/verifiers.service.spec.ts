import { VerifiersService, hashInvitationToken } from '../../src/verifiers/verifiers.service.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConflictException, ForbiddenException, GoneException, NotFoundException } from '@nestjs/common';

describe('VerifiersService', () => {
  let prisma: any;
  let notify: any;
  let audit: any;
  let access: any;
  let service: VerifiersService;
  const owner = { sub: 'owner-1' };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      vault: { findUnique: jest.fn() },
      vaultUserRole: { findUnique: jest.fn(), upsert: jest.fn() },
      vaultUserInvitation: { create: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    notify = { enqueueVerifierInvitation: jest.fn(), dispatchSoon: jest.fn(), cancelQueued: jest.fn() };
    audit = { log: jest.fn() };
    access = { assertManager: jest.fn(async () => ({ id: 'v1', userId: 'owner-1' })), assertNoActiveEvent: jest.fn(async () => undefined), lockVaultAssertNoActiveEvent: jest.fn(async () => undefined), lockVault: jest.fn(async () => undefined), assertNoActiveEventTx: jest.fn(async () => undefined) };
    service = new VerifiersService(prisma, notify, audit, access);
  });

  it('stores only the token hash, mails the raw token and does not return it', async () => {
    prisma.user.findUnique.mockImplementation(async ({ where }: any) =>
      where.id === 'owner-1' ? { id: 'owner-1', email: 'owner@example.com' } : null);
    prisma.vaultUserInvitation.findFirst.mockResolvedValue(null);
    prisma.vaultUserInvitation.create.mockImplementation(async ({ data }: any) => ({ id: 'i1', ...data }));

    const res = await service.invite(owner, { vault_id: 'v1', email: ' Ver@Example.com ', expires_in_hours: 10 } as any);

    const mailed = notify.enqueueVerifierInvitation.mock.calls[0];
    expect(mailed.slice(0, 2)).toEqual(['v1', 'ver@example.com']);
    expect(mailed[4]).toBe('i1'); // письмо привязано к приглашению: отзыв снимает его
    expect(mailed[5]).toBe(prisma); // в той же транзакции, что и приглашение
    expect(notify.dispatchSoon).toHaveBeenCalled();
    const stored = prisma.vaultUserInvitation.create.mock.calls[0][0].data;
    expect(stored.token).toBe(hashInvitationToken(mailed[2] as string));
    expect(stored.token).not.toBe(mailed[2]);
    expect(JSON.stringify(res)).not.toContain(mailed[2] as string);
    expect(access.assertManager).toHaveBeenCalledWith('owner-1', 'v1');
  });

  it('revoking an invitation cancels its unsent mail in the same transaction', async () => {
    prisma.vaultUserInvitation.findUnique.mockResolvedValue({ id: 'i1', vaultId: 'v1' });
    await service.revokeInvitation(owner, 'i1');
    expect(notify.cancelQueued).toHaveBeenCalledWith('verifier_invitation', 'i1', 'invitation revoked', prisma);
  });

  it('throws NotFound for an unknown token', async () => {
    prisma.vaultUserInvitation.findUnique.mockResolvedValue(null);
    await expect(service.acceptInvitation({ sub: 'u1' }, 'x'.repeat(32))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuses to accept for a different address and does not claim the invitation', async () => {
    prisma.vaultUserInvitation.findUnique.mockResolvedValue({ id: 'i1', vaultId: 'v1', email: 'ver@example.com', role: 'Verifier' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'someone.else@example.com' });
    await expect(service.acceptInvitation({ sub: 'u2' }, 'x'.repeat(32))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.vaultUserInvitation.updateMany).not.toHaveBeenCalled();
    expect(prisma.vaultUserRole.upsert).not.toHaveBeenCalled();
  });

  it('gives Gone when the conditional claim fails (used, revoked or expired)', async () => {
    prisma.vaultUserInvitation.findUnique.mockResolvedValue({ id: 'i1', vaultId: 'v1', email: 'ver@example.com', role: 'Verifier' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'VER@example.com' });
    prisma.vault.findUnique.mockResolvedValue({ id: 'v1', userId: 'owner-1' });
    prisma.vaultUserInvitation.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.acceptInvitation({ sub: 'u2' }, 'x'.repeat(32))).rejects.toBeInstanceOf(GoneException);
    expect(prisma.vaultUserRole.upsert).not.toHaveBeenCalled();
    // недействительное приглашение не раскрывает, идёт ли у сейфа событие
    expect(access.assertNoActiveEventTx).not.toHaveBeenCalled();
  });

  it('refuses while an event is active and does not create the role (the claim rolls back with the transaction)', async () => {
    prisma.vaultUserInvitation.findUnique.mockResolvedValue({ id: 'i1', vaultId: 'v1', email: 'ver@example.com', role: 'Verifier' });
    prisma.user.findUnique.mockResolvedValue({ id: 'u2', email: 'ver@example.com' });
    prisma.vault.findUnique.mockResolvedValue({ id: 'v1', userId: 'owner-1' });
    prisma.vaultUserInvitation.updateMany.mockResolvedValue({ count: 1 });
    access.assertNoActiveEventTx.mockRejectedValue(new ConflictException('active'));
    await expect(service.acceptInvitation({ sub: 'u2' }, 'x'.repeat(32))).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.vaultUserRole.upsert).not.toHaveBeenCalled(); // и транзакция откатывается вместе с отметкой «принято»
  });
});
