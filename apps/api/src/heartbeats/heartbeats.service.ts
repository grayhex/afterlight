import { Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateHeartbeatDto } from './dto/update-heartbeat.dto';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class HeartbeatsService {
  constructor(private prisma: PrismaService) {}

  private async ensureVaultOwner(userId: string, vaultId: string) {
    const v = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (!v) throw new ForbiddenException('Vault not found or access denied');
    return v;
  }

  private buildStatus(hb: any, now = new Date()) {
    const last = hb?.lastPingAt ?? hb?.createdAt ?? null;
    const timeoutDays = hb?.timeoutDays ?? 60;
    const dueAt = last ? addDays(new Date(last), Number(timeoutDays)) : addDays(now, Number(timeoutDays));
    const overdue = now > dueAt;
    return {
      last_ping_at: last,
      timeout_days: timeoutDays,
      method: hb?.method ?? 'manual',
      next_due_at: dueAt,
      overdue,
    };
  }

  async getConfig(userId: string, vaultId: string) {
    const v = await this.ensureVaultOwner(userId, vaultId);
    const hb = await this.prisma.heartbeat.findUnique({ where: { vaultId: v.id } });
    if (hb) return this.buildStatus(hb);
    return this.buildStatus({
      lastPingAt: null,
      timeoutDays: (v as any).heartbeatTimeoutDays ?? 60,
      method: 'manual',
      createdAt: v.createdAt,
    });
  }

  async updateConfig(userId: string, vaultId: string, dto: UpdateHeartbeatDto) {
    await this.ensureVaultOwner(userId, vaultId);
    const saved = await this.prisma.heartbeat.upsert({
      where: { vaultId },
      create: {
        vaultId,
        method: (dto.method ?? 'manual') as any,
        timeoutDays: dto.timeout_days ?? 60,
        lastPingAt: null,
      },
      update: {
        method: (dto.method as any) ?? undefined,
        timeoutDays: dto.timeout_days ?? undefined,
      },
    });
    return this.buildStatus(saved);
  }

  async ping(userId: string, vaultId: string, method?: 'auto' | 'manual') {
    await this.ensureVaultOwner(userId, vaultId);
    const saved = await this.prisma.heartbeat.upsert({
      where: { vaultId },
      create: {
        vaultId,
        method: (method ?? 'manual') as any,
        timeoutDays: 60,
        lastPingAt: new Date(),
      },
      update: {
        lastPingAt: new Date(),
        method: (method as any) ?? undefined,
      },
    });
    return this.buildStatus(saved);
  }

  async findOverdue(now = new Date()) {
    const all = await this.prisma.heartbeat.findMany({});
    return all
      .filter((hb) => {
        const due = addDays(new Date(hb.lastPingAt ?? hb.createdAt), Number(hb.timeoutDays ?? 60));
        return now > due;
      })
      .map((hb) => hb.vaultId);
  }
}
