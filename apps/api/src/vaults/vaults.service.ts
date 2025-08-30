import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVaultDto } from './dto/create-vault.dto';
import { UpdateVaultSettingsDto } from './dto/update-vault-settings.dto';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class VaultsService {
  constructor(private prisma: PrismaService, private audit: AuditService) {}

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
      quorumThreshold: 3,
      maxVerifiers: 5,
      heartbeatTimeoutDays: 60,
      graceHours: 24,
      isDemo: false,
    };
    const mkWrapped = randomBytes(32).toString('base64');
    const vault = await this.prisma.vault.create({
      data: {
        userId,
        status: 'Active',
        quorumThreshold: dto.quorum_threshold ?? defaults.quorumThreshold,
        maxVerifiers: dto.max_verifiers ?? defaults.maxVerifiers,
        heartbeatTimeoutDays: dto.heartbeat_timeout_days ?? defaults.heartbeatTimeoutDays,
        graceHours: dto.grace_hours ?? defaults.graceHours,
        isDemo: dto.is_demo ?? defaults.isDemo,
        mkWrapped,
      },
    });

    await this.audit.log(ActorType.User, userId, 'vault_create', 'Vault', vault.id);
    return vault;
  }

  async updateSettings(userId: string, id: string, dto: UpdateVaultSettingsDto) {
    await this.getForUser(userId, id);
    if (dto.primary_verifier_id) {
      await this.prisma.$transaction([
        this.prisma.vaultVerifier.updateMany({
          where: { vaultId: id, isPrimary: true },
          data: { isPrimary: false },
        }),
        this.prisma.vaultVerifier.updateMany({
          where: { vaultId: id, verifierId: dto.primary_verifier_id },
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
