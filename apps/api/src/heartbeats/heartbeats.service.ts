import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClockService } from '../clock/clock.service.js';
import { OrchestratorService } from '../orchestrator/orchestrator.service.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { UpdateHeartbeatDto } from './dto/update-heartbeat.dto.js';

const DAY_MS = 24 * 3600 * 1000;

/**
 * Heartbeat — явное подтверждение активности владельца. Единственный источник порога — `vault.heartbeatTimeoutDays`
 * (по контракту это порог допуска для верификатора, а не блокировка). Сам по себе heartbeat событий не создаёт
 * и ничего не раскрывает; ping после старта процесса отменяет его (D5).
 */
@Injectable()
export class HeartbeatsService {
  constructor(
    private prisma: PrismaService,
    private clock: ClockService,
    private orchestrator: OrchestratorService,
    private access: VaultAccessService,
  ) {}

  private async ensureVaultOwner(userId: string, vaultId: string) {
    const v = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (!v) throw new ForbiddenException('Vault not found or access denied');
    return v;
  }

  private status(vault: { heartbeatTimeoutDays: number; createdAt: Date }, hb: { lastPingAt: Date; method: string } | null, lastLoginAt: Date | null) {
    const now = this.clock.now();
    const last = Math.max(vault.createdAt.getTime(), hb?.lastPingAt?.getTime() ?? 0, lastLoginAt?.getTime() ?? 0);
    const nextDueAt = new Date(last + vault.heartbeatTimeoutDays * DAY_MS);
    return {
      last_ping_at: hb?.lastPingAt ?? null,
      last_activity_at: new Date(last),
      timeout_days: vault.heartbeatTimeoutDays,
      method: hb?.method ?? 'manual',
      next_due_at: nextDueAt,
      overdue: vault.heartbeatTimeoutDays > 0 && now.getTime() > nextDueAt.getTime(),
    };
  }

  async getConfig(userId: string, vaultId: string) {
    const v = await this.ensureVaultOwner(userId, vaultId);
    const [hb, owner] = await Promise.all([
      this.prisma.heartbeat.findUnique({ where: { vaultId: v.id } }),
      this.prisma.user.findUnique({ where: { id: v.userId }, select: { lastLoginAt: true } }),
    ]);
    return this.status(v, hb, owner?.lastLoginAt ?? null);
  }

  async updateConfig(userId: string, vaultId: string, dto: UpdateHeartbeatDto) {
    const v = await this.ensureVaultOwner(userId, vaultId);
    if (dto.timeout_days !== undefined) await this.access.assertNoActiveEvent(vaultId);
    const vault = dto.timeout_days !== undefined
      ? await this.prisma.vault.update({ where: { id: v.id }, data: { heartbeatTimeoutDays: dto.timeout_days } })
      : v;
    const hb = dto.method
      ? await this.prisma.heartbeat.upsert({
          where: { vaultId },
          create: { vaultId, method: dto.method, lastPingAt: this.clock.now() },
          update: { method: dto.method },
        })
      : await this.prisma.heartbeat.findUnique({ where: { vaultId } });
    const owner = await this.prisma.user.findUnique({ where: { id: v.userId }, select: { lastLoginAt: true } });
    return this.status(vault, hb, owner?.lastLoginAt ?? null);
  }

  async ping(userId: string, vaultId: string, method?: 'auto' | 'manual') {
    const v = await this.ensureVaultOwner(userId, vaultId);
    const now = this.clock.now();
    const hb = await this.prisma.heartbeat.upsert({
      where: { vaultId },
      create: { vaultId, method: method ?? 'manual', lastPingAt: now },
      update: { lastPingAt: now, method: method ?? undefined },
    });
    // D5: подтверждение владельца после старта процесса отменяет его
    await this.orchestrator.cancelOnOwnerActivity(userId, 'ping');
    const owner = await this.prisma.user.findUnique({ where: { id: v.userId }, select: { lastLoginAt: true } });
    return this.status(v, hb, owner?.lastLoginAt ?? null);
  }
}
