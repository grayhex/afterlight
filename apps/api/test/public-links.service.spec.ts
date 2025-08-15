import { PublicLinksService } from '../src/public-links/public-links.service';
import { describe, it, expect, beforeEach, jest } from '@jest/globals';

describe('PublicLinksService upsert', () => {
  let prisma: any;
  let service: PublicLinksService;

  beforeEach(() => {
    prisma = {
      block: { findUnique: jest.fn() },
      publicLink: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as any;
    service = new PublicLinksService(prisma);
  });

  it('preserves existing schedule and limits when not provided', async () => {
    const existingLink = {
      id: 'pl1',
      blockId: 'b1',
      enabled: false,
      publishFrom: new Date('2024-01-01T00:00:00Z'),
      publishUntil: new Date('2024-12-31T00:00:00Z'),
      tokenHash: 'hash',
      maxViews: 10,
      viewsCount: 2,
    };

    prisma.block.findUnique.mockResolvedValue({ id: 'b1', deletedAt: null, isPublic: false, vault: { userId: 'u1' } });
    prisma.publicLink.findUnique.mockResolvedValue(existingLink);

    const upsertMock = jest.fn(async () => ({ ...existingLink, enabled: true }));
    const blockUpdateMock = jest.fn();
    prisma.$transaction.mockImplementation(async (cb: any) => {
      return cb({ publicLink: { upsert: upsertMock }, block: { update: blockUpdateMock } });
    });

    const res = await service.upsert('u1', 'b1', { enabled: true } as any);

    expect(upsertMock).toHaveBeenCalledWith({
      where: { blockId: 'b1' },
      create: expect.any(Object),
      update: { enabled: true },
    });
    expect(res).toEqual({
      id: 'pl1',
      block_id: 'b1',
      enabled: true,
      publish_from: existingLink.publishFrom,
      publish_until: existingLink.publishUntil,
      max_views: 10,
      views_count: 2,
    });
  });
});
