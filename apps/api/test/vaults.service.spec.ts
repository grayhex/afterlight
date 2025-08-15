import { VaultsService } from '../src/vaults/vaults.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { UnauthorizedException, NotFoundException } from '@nestjs/common';

describe('VaultsService', () => {
  let prisma: any;
  let service: VaultsService;

  beforeEach(() => {
    prisma = {
      vault: {
        create: jest.fn(async ({ data }) => ({ id: 'v1', ...data })),
        findFirst: jest.fn(),
      },
    } as any;
    service = new VaultsService(prisma);
  });

  it('creates vault with generated mk_wrapped', async () => {
    const res = await service.createForUser('u1', {} as any);
    expect(prisma.vault.create).toHaveBeenCalled();
    const passed = prisma.vault.create.mock.calls[0][0].data;
    expect(passed.userId).toBe('u1');
    expect(passed.mkWrapped).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(res.mkWrapped).toBe(passed.mkWrapped);
  });

  it('throws Unauthorized when user id missing', async () => {
    await expect(service.createForUser('', {} as any)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('throws NotFound when vault not found', async () => {
    prisma.vault.findFirst.mockResolvedValue(null);
    await expect(service.getForUser('u1', 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
