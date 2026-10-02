import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ActorType, Prisma, Recipient } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { ClaimKeyDto, ClaimKeyResultDto } from './dto/claim-key.dto.js';
import { DeliveredBlockDto, DeliveryItemDto, ListDeliveriesDto } from './dto/delivery.dto.js';
import { KeyStatus, RecipientDto } from './dto/recipient.dto.js';
import { AuthenticatedUser } from '../common/current-user.decorator.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { AuditService } from '../audit/audit.service.js';
import { normalizeEmail } from '../common/email.js';
import { keyFingerprint, normalizeFingerprint } from '../common/key-fingerprint.js';
import { isRecipientPublicKey } from '../common/recipient-key.js';

const DENIED = 'Vault not found or access denied';

/**
 * Получатель принадлежит сейфу. Ключ заявляет сам получатель (аккаунт с подтверждённым адресом = контакт),
 * владелец подтверждает его отпечаток, сверенный вне сервера; DEK упаковывается только под подтверждённый отпечаток.
 */
interface DeliveryRow {
  block_id: string;
  vault_id: string;
  size: bigint | number;
  finalized_at: Date | null;
  ciphertext?: string;
  wrapped?: string;
  fingerprint?: string;
}

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
    // Формат фиксирован (ADR-0003): другой размер, тип или кодировка — не ключ получателя, под него нельзя ничего упаковывать
    if (!isRecipientPublicKey(pubkey)) {
      throw new BadRequestException('pubkey must be an RSA-OAEP 3072 public key (SPKI, base64, exponent 65537)');
    }
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
   * Выдача получателю (ADR-0003, поток 6): блоки, которые ему вправе отдать СЕЙЧАС. Условия проверяются заново при каждом
   * запросе, одним запросом к базе: событие раскрытия завершено (`Finalized`) и сейф раскрыт (`Released`); аккаунт — подтверждённый
   * адрес назначенного получателя в этом сейфе; ключ получателя подтверждён владельцем, а упаковка сделана под этот самый ключ;
   * блок этого сейфа, не удалён, текстовый и с шифротекстом. Участники сейфа выдачу не получают, даже если их адрес назначен
   * получателем (роли разделены, docs/mvp-contract.md): владелец, активный участник с любой ролью и администратор платформы.
   * Шифротекст читается только при запросе одного блока; список его не загружает.
   */
  private async deliveries(user: AuthenticatedUser, opts: { blockId?: string; cursor?: string; limit?: number; withPayload?: boolean }): Promise<DeliveryRow[]> {
    const account = await this.prisma.user.findUnique({ where: { id: user.sub }, select: { email: true, emailVerifiedAt: true, role: true } });
    if (!account || !account.emailVerifiedAt) throw new ForbiddenException('Email address is not verified');
    if (account.role === 'Admin') return []; // глобальная роль администратора доступа к содержимому сейфов не даёт
    const payload = opts.withPayload ? Prisma.sql`b.ciphertext AS ciphertext, br.dek_wrapped_for_recipient AS wrapped, br.wrapped_for_fingerprint AS fingerprint,` : Prisma.empty;
    return this.prisma.$queryRaw<DeliveryRow[]>(Prisma.sql`
      SELECT ${payload}
        br.block_id AS block_id,
        b.vault_id AS vault_id,
        COALESCE(b.size, octet_length(b.ciphertext))::bigint AS size,
        (SELECT max(e.finalized_at) FROM "verification_event" e WHERE e.vault_id = v.id AND e.state = 'Finalized') AS finalized_at
      FROM "block_recipient" br
      JOIN "recipient" r ON r.id = br.recipient_id
      JOIN "block" b ON b.id = br.block_id
      JOIN "vault" v ON v.id = b.vault_id
      WHERE r.contact = ${normalizeEmail(account.email)}
        AND r.vault_id = b.vault_id
        AND r.verification_status = 'KeyConfirmed'
        AND r.key_confirmed_fingerprint IS NOT NULL
        AND br.wrapped_for_fingerprint = r.key_confirmed_fingerprint
        AND b.deleted_at IS NULL AND b.ciphertext IS NOT NULL AND b.type = 'text'
        AND v.status = 'Released'
        AND EXISTS (SELECT 1 FROM "verification_event" e WHERE e.vault_id = v.id AND e.state = 'Finalized')
        AND v.user_id <> ${user.sub}::uuid
        AND NOT EXISTS (SELECT 1 FROM "vault_user_role" ur WHERE ur.vault_id = v.id AND ur.user_id = ${user.sub}::uuid AND ur.status = 'Active')
        ${opts.blockId ? Prisma.sql`AND br.block_id = ${opts.blockId}::uuid` : Prisma.empty}
        ${opts.cursor ? Prisma.sql`AND br.block_id > ${opts.cursor}::uuid` : Prisma.empty}
      ORDER BY br.block_id
      LIMIT ${opts.limit ?? 200}`);
  }

  async listDeliveries(user: AuthenticatedUser, q: ListDeliveriesDto = {}): Promise<DeliveryItemDto[]> {
    const rows = await this.deliveries(user, { cursor: q.cursor, limit: q.limit ?? 50 });
    return rows.map((r) => ({ block_id: r.block_id, vault_id: r.vault_id, finalized_at: r.finalized_at, size: Number(r.size) }));
  }

  async getDelivery(user: AuthenticatedUser, blockId: string): Promise<DeliveredBlockDto> {
    const [row] = await this.deliveries(user, { blockId, limit: 1, withPayload: true });
    // «Нет назначения», «ещё не раскрыто», «ключ не подтверждён», «чужой блок», «вы участник сейфа» — неразличимы
    if (!row) throw new NotFoundException('Nothing to deliver for this block');
    await this.audit.log(ActorType.User, user.sub, 'block_delivered', 'Block', blockId);
    return {
      block_id: row.block_id,
      vault_id: row.vault_id,
      ciphertext: row.ciphertext as string,
      dek_wrapped_for_recipient: row.wrapped as string,
      key_fingerprint: row.fingerprint as string,
      finalized_at: row.finalized_at,
    };
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
