import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecipientDto } from './dto/create-recipient.dto.js';
import { AuthenticatedUser } from '../common/current-user.decorator.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';

@Injectable()
export class RecipientsService {
  constructor(private prisma: PrismaService, private access: VaultAccessService) {}

  async createOrGet(user: AuthenticatedUser, dto: CreateRecipientDto) {
    // Назначать получателей вправе только владелец/управляющий сейфом; верификатор — нет.
    await this.access.assertManager(user.sub, dto.vault_id);

    const contact = dto.contact;
    const existing = await this.prisma.recipient.findUnique({ where: { contact } });
    if (!existing) {
      return this.prisma.recipient.create({
        data: { contact, pubkey: dto.pubkey ?? null, verificationStatus: 'Invited' as any },
      });
    }
    // Запись получателя общая для всех сейфов: уже заданный публичный ключ чужим запросом не подменяется
    // (иначе DEK, упакованный владельцем под "ключ получателя", достался бы автору подмены).
    if (dto.pubkey && existing.pubkey && dto.pubkey !== existing.pubkey) {
      throw new ConflictException('Recipient already has a different public key');
    }
    if (dto.pubkey && !existing.pubkey) {
      return this.prisma.recipient.update({ where: { id: existing.id }, data: { pubkey: dto.pubkey } });
    }
    return existing;
  }

  async search(user: AuthenticatedUser, vaultId: string, query?: string) {
    await this.access.assertManager(user.sub, vaultId);

    const where = query
      ? { contact: { contains: query, mode: 'insensitive' as const } }
      : {};
    return this.prisma.recipient.findMany({
      where: {
        ...where,
        blocks: {
          some: {
            block: {
              vaultId,
            },
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }
}
