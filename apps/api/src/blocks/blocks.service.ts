import { Injectable, BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateBlockDto } from './dto/create-block.dto.js';
import { AssignRecipientDto } from './dto/assign-recipient.dto.js';
import { AuditService } from '../audit/audit.service.js';
import { ActorType, Prisma } from '@prisma/client';
import { normalizeFingerprint } from '../common/key-fingerprint.js';
import { BlockRecipientDto } from './dto/block-recipient.dto.js';
import { BlockDetailDto, BlockDto } from './dto/block-response.dto.js';
import { hasVaultKey, isRsa3072Wrap } from '../common/envelope.js';

@Injectable()
export class BlocksService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

  private async ensureVaultOwner(userId: string, vaultId: string) {
    const v = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (!v) throw new ForbiddenException('Vault not found or access denied');
    return v;
  }

  private toDto(b: Prisma.BlockGetPayload<object>): BlockDto {
    return {
      id: b.id,
      vault_id: b.vaultId,
      type: b.type,
      dek_wrapped: b.dekWrapped,
      metadata: b.metadata,
      tags: b.tags,
      size: b.size === null ? null : Number(b.size),
      checksum: b.checksum,
      is_public: b.isPublic,
      created_at: b.createdAt,
      updated_at: b.updatedAt,
    };
  }

  private toDetailDto(b: Prisma.BlockGetPayload<object>): BlockDetailDto {
    return { ...this.toDto(b), ciphertext: b.ciphertext };
  }

  async list(userId: string, vaultId: string, cursor?: string, limit = 50): Promise<BlockDto[]> {
    await this.ensureVaultOwner(userId, vaultId);
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    // Шифротекст в список не попадает: до 200 блоков по десятки килобайт — лишний трафик; он отдаётся при чтении блока
    const rows = await this.prisma.block.findMany({
      where: { vaultId, deletedAt: null },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
      omit: { ciphertext: true },
    });
    return rows.map((b) => this.toDto({ ...b, ciphertext: null }));
  }

  async get(userId: string, id: string): Promise<BlockDetailDto> {
    const b = await this.prisma.block.findUnique({
      where: { id },
      include: { vault: true },
    });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    return this.toDetailDto(b);
  }

  async create(userId: string, dto: CreateBlockDto): Promise<BlockDetailDto> {
    const v = await this.ensureVaultOwner(userId, dto.vault_id);
    // Без ключа сейфа у владельца нет способа прочитать блок обратно: сначала настройка ключа (PUT /vaults/:id/key)
    if (!hasVaultKey(v.mkWrapped)) throw new ConflictException('The vault key is not set up yet');

    let metadata: any = undefined;
    if (typeof dto.metadata === 'string') {
      try { metadata = JSON.parse(dto.metadata); } catch { throw new BadRequestException('metadata must be valid JSON'); }
    } else if (dto.metadata !== undefined) {
      metadata = dto.metadata;
    }

    const block = await this.prisma.block.create({
      data: {
        id: dto.id,
        vaultId: v.id,
        type: dto.type as any,
        dekWrapped: dto.dek_wrapped,
        ciphertext: dto.ciphertext,
        metadata,
        tags: dto.tags ?? [],
        size: Buffer.byteLength(dto.ciphertext, 'utf8'),
        checksum: dto.checksum,
        isPublic: dto.is_public ?? false,
      },
    });
    await this.audit.log(ActorType.User, userId, 'block_create', 'Block', block.id);
    return this.toDetailDto(block);
  }

  async softDelete(userId: string, id: string) {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    await this.prisma.block.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log(ActorType.User, userId, 'block_soft_delete', 'Block', id);
  }

  async listRecipients(userId: string, blockId: string): Promise<BlockRecipientDto[]> {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id: blockId } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');
    const rows = await this.prisma.blockRecipient.findMany({
      where: { blockId },
      include: { recipient: true },
      orderBy: { createdAt: 'desc' },
    });
    // Явный ответ: упаковка действительна, только пока она сделана под нынешний подтверждённый ключ получателя
    return rows.map((br) => ({
      block_id: br.blockId,
      recipient_id: br.recipientId,
      contact: br.recipient.contact,
      key_status: br.recipient.verificationStatus,
      wrapped_for_fingerprint: br.wrappedForFingerprint,
      wrap_valid: !!br.wrappedForFingerprint && br.wrappedForFingerprint === br.recipient.keyConfirmedFingerprint,
      created_at: br.createdAt,
    }));
  }

  async assignRecipient(userId: string, blockId: string, dto: AssignRecipientDto): Promise<BlockRecipientDto> {
    const b = await this.prisma.block.findUnique({ include: { vault: true }, where: { id: blockId } });
    if (!b || b.deletedAt) throw new NotFoundException('Block not found');
    if (b.vault.userId !== userId) throw new ForbiddenException('Access denied');

    // Упаковка под RSA-OAEP 3072 всегда ровно 384 байта: всё остальное — не упаковка ключа (ADR-0003)
    const wrapped = dto.dek_wrapped_for_recipient?.trim();
    if (!isRsa3072Wrap(wrapped)) {
      throw new BadRequestException('dek_wrapped_for_recipient must be a base64 RSA-OAEP 3072 ciphertext (384 bytes)');
    }
    const fingerprint = normalizeFingerprint(dto.key_fingerprint);

    const result = await this.prisma.$transaction(async (tx) => {
      // Строка получателя блокируется: смена ключа и назначение идут по очереди
      await tx.$queryRaw(Prisma.sql`SELECT id FROM "recipient" WHERE id = ${dto.recipient_id}::uuid FOR UPDATE`);
      const r = await tx.recipient.findUnique({ where: { id: dto.recipient_id } });
      // Получатель другого сейфа (и унаследованный без сейфа) неотличим от несуществующего
      if (!r || r.vaultId !== b.vaultId) throw new NotFoundException('Recipient not found');
      if (r.verificationStatus !== 'KeyConfirmed' || !r.keyConfirmedFingerprint) {
        throw new ConflictException('The recipient key is not confirmed by the owner');
      }
      if (r.keyConfirmedFingerprint !== fingerprint) {
        throw new ConflictException('DEK must be wrapped for the confirmed key of the recipient');
      }
      return tx.blockRecipient.upsert({
        where: { blockId_recipientId: { blockId, recipientId: r.id } },
        create: { blockId, recipientId: r.id, dekWrappedForRecipient: wrapped, wrappedForFingerprint: fingerprint },
        update: { dekWrappedForRecipient: wrapped, wrappedForFingerprint: fingerprint },
        include: { recipient: true },
      });
    });
    await this.audit.log(ActorType.User, userId, 'block_assign_recipient', 'Block', blockId);
    return {
      block_id: result.blockId,
      recipient_id: result.recipientId,
      contact: result.recipient.contact,
      key_status: result.recipient.verificationStatus,
      wrapped_for_fingerprint: result.wrappedForFingerprint,
      wrap_valid: true,
      created_at: result.createdAt,
    };
  }
}
