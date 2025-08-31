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
      user: { upsert: jest.fn() },
      vaultUserRole: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      vaultUserInvitation: { create: jest.fn() },
    } as any;
    notify = { sendVerifierInvitation: jest.fn() } as any;
    service = new VerifiersService(prisma, notify);
  });

  it('invites verifier and sends notification', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1', email: 'ver@example.com' });
    prisma.vaultUserRole.findUnique.mockResolvedValue(null);
    const link = { id: 'l1', vaultId: 'v1', userId: 'u1', status: 'Invited', isPrimary: false };
    prisma.vaultUserRole.create.mockResolvedValue(link);
    prisma.vaultUserInvitation.create.mockResolvedValue({});

    const dto = { vault_id: 'v1', email: 'ver@example.com', expires_in_hours: 10 } as any;
    const res = await service.invite(dto, 'token123');

    expect(res).toEqual({ invitation: link, token: 'token123' });
    expect(prisma.user.upsert).toHaveBeenCalled();
    expect(notify.sendVerifierInvitation).toHaveBeenCalledWith('v1', 'ver@example.com', 'token123');
  });

  it('throws when already invited', async () => {
    prisma.user.upsert.mockResolvedValue({ id: 'u1', email: 'ver@example.com' });
    prisma.vaultUserRole.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(service.invite({ vault_id: 'v1', email: 'ver@example.com' } as any, 't')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws NotFound when accepting missing invitation', async () => {
    prisma.vaultUserRole.findUnique.mockResolvedValue(null);
    await expect(service.acceptInvitation('v1', 'u1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
