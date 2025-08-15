import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlockDto } from './dto/create-block.dto';
import { AssignRecipientDto } from './dto/assign-recipient.dto';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService) {}

  private async ensureVaultOwner(userId: string, vaultId: string) {
    const v = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (!v) throw new ForbiddenException('Vault not found or access denied');
    return v;
  }

  async list(userId: string, vaultId: string, cursor?: string, limit = 50) {
    await this.ensureVaultOwner(userId, vaultId);
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.prisma.block.findMany({
      where: { vaultId, deletedAt: null },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(userId: string, id: string) {
    const b = await this.prisma.block.findUnique({
      where: { id },
      include: { vault: true },
    });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    const { vault, ...rest } = b as any;
    return rest;
  }

  async create(userId: string, dto: CreateBlockDto) {
    const v = await this.ensureVaultOwner(userId, dto.vault_id);

    let metadata: any = undefined;
    if (typeof dto.metadata === 'string') {
      try { metadata = JSON.parse(dto.metadata); } catch { throw new BadRequestException('metadata must be valid JSON'); }
    } else if (dto.metadata !== undefined) {
      metadata = dto.metadata;
    }

    return this.prisma.block.create({
      data: {
        vaultId: v.id,
        type: dto.type as any,
        dekWrapped: dto.dek_wrapped,
        metadata,
        tags: dto.tags ?? [],
        size: dto.size as any,
        checksum: dto.checksum,
        isPublic: dto.is_public ?? false,
      },
    });
  }

  async softDelete(userId: string, id: string) {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.block.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async listRecipients(userId: string, blockId: string) {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id: blockId } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    return this.prisma.blockRecipient.findMany({
      where: { blockId },
      include: { recipient: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async assignRecipient(userId: string, blockId: string, dto: AssignRecipientDto) {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id: blockId } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');

    const r = await this.prisma.recipient.findUnique({ where: { id: dto.recipient_id } });
    if (!r) throw new NotFoundException('Recipient not found');

    const wrapped = dto.dek_wrapped_for_recipient?.trim();
    if (!wrapped) throw new BadRequestException('dek_wrapped_for_recipient must not be empty');
    if (!wrapped.includes('.') && !/^[A-Za-z0-9+/]+={0,2}$/.test(wrapped)) {
      throw new BadRequestException('dek_wrapped_for_recipient must be base64 or JWE');
    }

    const br = await this.prisma.blockRecipient.upsert({
      where: { blockId_recipientId: { blockId, recipientId: dto.recipient_id } },
      create: {
        blockId,
        recipientId: dto.recipient_id,
        dekWrappedForRecipient: wrapped,
      },
      update: {
        dekWrappedForRecipient: wrapped,
      },
      include: { recipient: true },
    });
    return br;
  }
}
