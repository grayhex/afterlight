import { VaultsService } from '../../src/vaults/vaults.service.js';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { NotFoundException } from '@nestjs/common';

describe('VaultsService', () => {
  let prisma: any;
  let audit: any;
  let service: VaultsService;

  beforeEach(() => {
    prisma = {
      vault: {
        create: jest.fn(async ({ data }) => ({ id: 'v1', ...data })),
        findFirst: jest.fn(),
      },
    } as any;
    audit = { log: jest.fn() };
    service = new VaultsService(prisma, audit, { assertNoActiveEvent: jest.fn() } as any);
  });

  it('creates a vault without a server-generated key (the browser of the owner sets it once)', async () => {
    await service.createForUser('u1', {} as any);
    expect(prisma.vault.create).toHaveBeenCalled();
    const passed = prisma.vault.create.mock.calls[0][0].data;
    expect(passed.userId).toBe('u1');
    expect(passed).not.toHaveProperty('mkWrapped');
  });

  it('throws NotFound when vault not found', async () => {
    prisma.vault.findFirst.mockResolvedValue(null);
    await expect(service.getForUser('u1', 'v1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
