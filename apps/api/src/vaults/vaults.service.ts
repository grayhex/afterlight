import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateVaultDto } from './dto/create-vault.dto.js';
import { UpdateVaultSettingsDto } from './dto/update-vault-settings.dto.js';
import { SetVaultKeyDto } from './dto/set-vault-key.dto.js';
import { VaultKeyDto } from './dto/vault-key.dto.js';
import { KEY_ENVELOPE_PATTERN } from '../common/envelope.js';
import { AuditService } from '../audit/audit.service.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { ActorType, Prisma } from '@prisma/client';

@Injectable()
export class VaultsService {
  constructor(private prisma: PrismaService, private audit: AuditService, private access: VaultAccessService) {}

  async listForUser(userId: string, cursor?: string, limit = 50) {
    const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
    return this.prisma.vault.findMany({
      where: { userId },
      take,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { createdAt: 'desc' },
    });
  }

  async getForUser(userId: string, id: string) {
    const v = await this.prisma.vault.findFirst({ where: { id, userId } });
    if (!v) throw new NotFoundException('Vault not found');
    return v;
  }

  async createForUser(userId: string, dto: CreateVaultDto) {
    const defaults = {
      quorumThreshold: 2,
      maxVerifiers: 3,
      heartbeatTimeoutDays: 30,
      graceHours: 24,
      isDemo: false,
    };
    const name = dto.name?.trim();
    const description = dto.description?.trim();
    const vault = await this.prisma.vault.create({
      data: {
        userId,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
        status: 'Active',
        quorumThreshold: dto.quorum_threshold ?? defaults.quorumThreshold,
        maxVerifiers: dto.max_verifiers ?? defaults.maxVerifiers,
        heartbeatTimeoutDays: dto.heartbeat_timeout_days ?? defaults.heartbeatTimeoutDays,
        graceHours: dto.grace_hours ?? defaults.graceHours,
        isDemo: dto.is_demo ?? defaults.isDemo,
        // Ключ сейфа сервер не создаёт: его задаёт браузер владельца (PUT /vaults/:id/key), когда известен id сейфа
      },
    });

    await this.audit.log(ActorType.User, userId, 'vault_create', 'Vault', vault.id);
    return vault;
  }

  /** Ключ сейфа задаётся один раз и только владельцем; сервер хранит конверт как непрозрачную строку (ADR-0003). */
  async setKey(userId: string, id: string, dto: SetVaultKeyDto): Promise<VaultKeyDto> {
    await this.access.assertOwner(userId, id);
    // Условное обновление одним запросом: два одновременных запроса не перезапишут друг друга. «Не настроен» — это NULL
    // или значение не в формате конверта (случайная строка прежнего сервера, которую мог вставить старый API при обновлении)
    const count = await this.prisma.$executeRaw(Prisma.sql`
      UPDATE "vault" SET "mk_wrapped" = ${dto.mk_wrapped}, "updated_at" = now()
      WHERE "id" = ${id}::uuid AND "user_id" = ${userId}::uuid
        AND ("mk_wrapped" IS NULL OR "mk_wrapped" !~ ${KEY_ENVELOPE_PATTERN.source})`);
    if (count === 0) throw new ConflictException('The vault key is already set up');
    await this.audit.log(ActorType.User, userId, 'vault_set_key', 'Vault', id);
    return { id, mk_wrapped: dto.mk_wrapped };
  }

  async updateSettings(userId: string, id: string, dto: UpdateVaultSettingsDto) {
    await this.getForUser(userId, id);
    // D4: пока идёт процесс раскрытия, настройки сейфа не меняются (сначала отмена)
    await this.access.assertNoActiveEvent(id);
    if (dto.primary_verifier_id) {
      const target = await this.prisma.vaultUserRole.findFirst({
        where: { vaultId: id, userId: dto.primary_verifier_id, role: 'Verifier', status: 'Active' },
      });
      if (!target) throw new BadRequestException('primary_verifier_id must be an active verifier of this vault');
      await this.prisma.$transaction([
        this.prisma.vaultUserRole.updateMany({
          where: { vaultId: id, isPrimary: true },
          data: { isPrimary: false },
        }),
        this.prisma.vaultUserRole.updateMany({
          where: { vaultId: id, userId: dto.primary_verifier_id },
          data: { isPrimary: true },
        }),
      ]);
    }
    const updated = await this.prisma.vault.update({
      where: { id },
      data: {
        ...(dto.quorum_threshold !== undefined ? { quorumThreshold: dto.quorum_threshold } : {}),
        ...(dto.max_verifiers !== undefined ? { maxVerifiers: dto.max_verifiers } : {}),
        ...(dto.heartbeat_timeout_days !== undefined ? { heartbeatTimeoutDays: dto.heartbeat_timeout_days } : {}),
        ...(dto.grace_hours !== undefined ? { graceHours: dto.grace_hours } : {}),
      },
    });
    await this.audit.log(ActorType.User, userId, 'vault_update_settings', 'Vault', id);
    return updated;
  }
}
