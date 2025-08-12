import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdatePublicLinkDto } from './dto/update-public-link.dto';
import { createHash, randomBytes } from 'crypto';

function sha256hex(v: string) { return createHash('sha256').update(v).digest('hex'); }

@Injectable()
export class PublicLinksService {
  constructor(private prisma: PrismaService) {}

  private async ensureOwner(userId: string, blockId: string) {
    const b = await this.prisma.block.findUnique({ where: { id: blockId }, include: { vault: true } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    return b;
  }

  async getForBlock(userId: string, blockId: string) {
    await this.ensureOwner(userId, blockId);
    const link = await this.prisma.publicLink.findUnique({ where: { blockId }, include: { block: false } });
    return link ?? null;
  }

  async upsert(userId: string, blockId: string, dto: UpdatePublicLinkDto) {
    const b = await this.ensureOwner(userId, blockId);

    const publishFrom = dto.publish_from ? new Date(dto.publish_from) : new Date();
    const publishUntil = dto.publish_until ? new Date(dto.publish_until) : null;
    if (publishUntil && publishUntil <= publishFrom) {
      throw new BadRequestException('publish_until must be after publish_from');
    }

    const existing = await this.prisma.publicLink.findUnique({ where: { blockId } });

    let token: string | null = null;
    let tokenHash: string | undefined = undefined;

    if (!existing) {
      token = randomBytes(24).toString('base64url');
      tokenHash = sha256hex(token);
    }

    const saved = await this.prisma.$transaction(async (tx) => {
      const pl = await tx.publicLink.upsert({
        where: { blockId },
        create: {
          blockId,
          enabled: dto.enabled,
          publishFrom,
          publishUntil,
          tokenHash: tokenHash ?? (existing as any)?.tokenHash,
          maxViews: dto.max_views ?? null,
          viewsCount: 0,
        },
        update: {
          enabled: dto.enabled,
          publishFrom,
          publishUntil,
          maxViews: dto.max_views ?? null,
        },
      });

      if (dto.enabled && !b.isPublic) {
        await tx.block.update({ where: { id: blockId }, data: { isPublic: true } });
      }
      if (!dto.enabled && b.isPublic) {
        await tx.block.update({ where: { id: blockId }, data: { isPublic: false } });
      }

      return pl;
    });

    const base = process.env.PUBLIC_BASE_URL || '';
    return {
      ...saved,
      url: token ? (base + `/p/${token}`) : undefined,
    };
  }

  async disable(userId: string, blockId: string) {
    await this.ensureOwner(userId, blockId);
    return this.prisma.$transaction(async (tx) => {
      await tx.block.update({ where: { id: blockId }, data: { isPublic: false } });
      return tx.publicLink.update({ where: { blockId }, data: { enabled: false } });
    });
  }

  async resolveByToken(token: string) {
    if (!token) throw new NotFoundException();
    const tokenHash = sha256hex(token);
    const link = await this.prisma.publicLink.findFirst({ where: { tokenHash } });
    if (!link || !link.enabled) throw new NotFoundException();

    const now = new Date();
    if (link.publishFrom && now < link.publishFrom) throw new NotFoundException();
    if (link.publishUntil && now > link.publishUntil) throw new NotFoundException();
    if (link.maxViews && link.viewsCount >= link.maxViews) throw new NotFoundException();

    const block = await this.prisma.block.findUnique({ where: { id: link.blockId } });
    if (!block || block.deletedAt || !block.isPublic) throw new NotFoundException();

    await this.prisma.publicLink.update({ where: { id: link.id }, data: { viewsCount: { increment: 1 } as any } });

    return {
      block_id: block.id,
      type: block.type,
      tags: block.tags,
      updated_at: (block as any).updatedAt,
    };
  }
}
