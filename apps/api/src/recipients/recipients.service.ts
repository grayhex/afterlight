import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ActorType, Prisma, Recipient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { ClaimKeyDto, ClaimKeyResultDto } from './dto/claim-key.dto.js';
import { KeyStatus, RecipientDto } from './dto/recipient.dto.js';
import { AuthenticatedUser } from '../common/current-user.decorator.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { normalizeEmail } from '../common/email.js';
import { keyFingerprint, normalizeFingerprint } from '../common/key-fingerprint.js';

const DENIED = 'Vault not found or access denied';

/**
 * Получатель принадлежит сейфу. Ключ заявляет сам получатель (аккаунт с подтверждённым адресом = контакт),
 * владелец подтверждает его отпечаток, сверенный вне сервера; DEK упаковывается только под подтверждённый отпечаток.
 */
@Injectable()
export class RecipientsService {
  constructor(private prisma: PrismaService, private access: VaultAccessService, private audit: AuditService) {}

  static toDto(r: Recipient & { vaultId: string }): RecipientDto {
    return {
      id: r.id,
      vault_id: r.vaultId,
      contact: r.contact,
      key_status: r.verificationStatus as KeyStatus,
      public_key: r.pubkey,
      key_fingerprint: r.keyFingerprint,
      key_confirmed_at: r.keyConfirmedAt,
      created_at: r.createdAt,
    };
  }

  async createOrGet(user: AuthenticatedUser, dto: CreateRecipientDto): Promise<RecipientDto> {
    // Назначать получателей вправе только владелец/управляющий сейфом; верификатор — нет.
    await this.access.assertManager(user.sub, dto.vault_id);
    const contact = normalizeEmail(dto.contact);
    const where = { vaultId_contact: { vaultId: dto.vault_id, contact } };
    const existing = await this.prisma.recipient.findUnique({ where });
    if (existing) return RecipientsService.toDto(existing as Recipient & { vaultId: string });
    try {
      const created = await this.prisma.recipient.create({ data: { vaultId: dto.vault_id, contact } });
      await this.audit.log(ActorType.User, user.sub, 'recipient_create', 'Recipient', created.id);
      return RecipientsService.toDto(created as Recipient & { vaultId: string });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return RecipientsService.toDto((await this.prisma.recipient.findUniqueOrThrow({ where })) as Recipient & { vaultId: string });
      }
      throw e;
    }
  }

  async search(user: AuthenticatedUser, vaultId: string, query?: string): Promise<RecipientDto[]> {
    await this.access.assertManager(user.sub, vaultId);
    const rows = await this.prisma.recipient.findMany({
      where: { vaultId, ...(query ? { contact: { contains: query, mode: 'insensitive' as const } } : {}) },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => RecipientsService.toDto(r as Recipient & { vaultId: string }));
  }

  /**
   * Получатель заявляет свой ключ. Право даёт только вошедший аккаунт, чей подтверждённый адрес совпадает с контактом:
   * ключ нельзя заявить за другого, а владелец ключ не задаёт. Смена ключа сбрасывает подтверждение.
   */
  async claimKey(user: AuthenticatedUser, dto: ClaimKeyDto): Promise<ClaimKeyResultDto> {
    const account = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, emailVerifiedAt: true } });
    if (!account || !account.emailVerifiedAt) throw new ForbiddenException('Email address is not verified');
    const pubkey = dto.pubkey.trim();
    if (!pubkey) throw new ConflictException('Public key must not be empty');
    const fingerprint = keyFingerprint(pubkey);
    const contact = normalizeEmail(account.email);

    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const rows = await tx.recipient.findMany({ where: { contact, vaultId: { not: null } }, select: { id: true, keyFingerprint: true } });
      for (const r of rows) {
        if (r.keyFingerprint === fingerprint) continue; // тот же ключ: подтверждение сохраняется
        await tx.recipient.update({
          where: { id: r.id },
          data: {
            pubkey,
            keyFingerprint: fingerprint,
            keyClaimedAt: now,
            keyConfirmedFingerprint: null,
            keyConfirmedAt: null,
            verificationStatus: 'KeyClaimed',
          },
        });
        await this.audit.log(ActorType.User, user.sub, 'recipient_key_claim', 'Recipient', r.id, fingerprint, tx);
      }
      return rows.length;
    });
    return { key_fingerprint: fingerprint, recipients: updated };
  }

  /**
   * Владелец подтверждает отпечаток, который сверил с получателем вне сервера. Сервер лишь проверяет, что подтверждается
   * именно текущий заявленный ключ (не успевший смениться), и фиксирует это.
   */
  async confirmKey(user: AuthenticatedUser, recipientId: string, rawFingerprint: string): Promise<RecipientDto> {
    const recipient = await this.prisma.recipient.findUnique({ where: { id: recipientId } });
    // Чужой, несуществующий и унаследованный без сейфа получатель неразличимы
    if (!recipient || !recipient.vaultId) throw new ForbiddenException(DENIED);
    await this.access.assertManager(user.sub, recipient.vaultId);
    if (!recipient.keyFingerprint) throw new ConflictException('The recipient has not claimed a public key yet');
    const fingerprint = normalizeFingerprint(rawFingerprint);
    if (fingerprint !== recipient.keyFingerprint) throw new ConflictException('The fingerprint does not match the claimed key');

    const now = new Date();
    // Условие на отпечаток в самом UPDATE: ключ мог смениться между чтением и подтверждением
    const res = await this.prisma.recipient.updateMany({
      where: { id: recipientId, keyFingerprint: fingerprint },
      data: { keyConfirmedFingerprint: fingerprint, keyConfirmedAt: now, verificationStatus: 'KeyConfirmed' },
    });
    if (res.count !== 1) throw new ConflictException('The recipient key changed; verify the new fingerprint');
    await this.audit.log(ActorType.User, user.sub, 'recipient_key_confirm', 'Recipient', recipientId, fingerprint);
    return RecipientsService.toDto((await this.prisma.recipient.findUniqueOrThrow({ where: { id: recipientId } })) as Recipient & { vaultId: string });
  }
}
