import { VerifiersService } from '../src/verifiers/verifiers.service';
import { NotificationsService } from '../src/notifications/notifications.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('VerifiersService', () => {
  let prisma: any;
  let notify: NotificationsService;
  let service: VerifiersService;

  beforeEach(() => {
    prisma = {
      verifier: { upsert: jest.fn() },
      vaultVerifier: { findUnique: jest.fn(), create: jest.fn() },
      verifierInvitation: { create: jest.fn() },
    } as any;
    notify = { sendVerifierInvitation: jest.fn() } as any;
    service = new VerifiersService(prisma, notify);
  });

  it('invites verifier and sends notification', async () => {
    prisma.verifier.upsert.mockResolvedValue({ id: 'ver1', contact: 'ver@example.com' });
    prisma.vaultVerifier.findUnique.mockResolvedValue(null);
    const link = { id: 'l1', vaultId: 'v1', verifierId: 'ver1', roleStatus: 'Invited', isPrimary: false };
    prisma.vaultVerifier.create.mockResolvedValue(link);
    prisma.verifierInvitation.create.mockResolvedValue({});

    const dto = { vault_id: 'v1', contact: 'ver@example.com', expires_in_hours: 10 } as any;
    const res = await service.invite(dto, 'token123');

    expect(res).toEqual({ invitation: link, token: 'token123' });
    expect(prisma.verifier.upsert).toHaveBeenCalled();
    expect(notify.sendVerifierInvitation).toHaveBeenCalledWith('v1', 'ver@example.com', 'token123');
  });

  it('throws when already invited', async () => {
    prisma.verifier.upsert.mockResolvedValue({ id: 'ver1', contact: 'ver@example.com' });
    prisma.vaultVerifier.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.invite({ vault_id: 'v1', contact: 'ver@example.com' } as any, 't')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when accepting missing invitation', async () => {
    prisma.vaultVerifier.findUnique.mockResolvedValue(null);
    await expect(service.acceptInvitation('v1', 'ver1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
