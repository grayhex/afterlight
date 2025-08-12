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
      last_ping_at: hb?.lastPingAt ?? null,
      timeout_days: timeoutDays,
      method: hb?.method ?? 'manual',
      next_due_at: dueAt,
      overdue,
    };
  }

  async getConfig(userId: string, vaultId: string) {
    const v = await this.ensureVaultOwner(userId, vaultId);
    const hb = await this.prisma.heartbeat.findUnique({ where: { vaultId: v.id } });
    if (hb) {
      // подмешиваем createdAt сейфа как «опорную» дату
      return this.buildStatus({ ...hb, createdAt: v.createdAt });
    }
    // нет записи — статус по дефолтам сейфа
    return this.buildStatus({
      lastPingAt: undefined,
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
        // lastPingAt: null,  // <-- не задаём null
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

  /** Возвращает массив vaultId c просроченным heartbeat */
  async findOverdue(now = new Date()) {
    const all = await this.prisma.heartbeat.findMany({ include: { vault: true } }); // <-- тянем vault
    return all
      .filter((hb) => {
        const base = hb.lastPingAt ?? hb.vault.createdAt; // <-- вместо hb.createdAt
        const due = addDays(new Date(base), Number(hb.timeoutDays ?? 60));
        return now > due;
      })
      .map((hb) => hb.vaultId);
  }
}
