import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class HeartbeatProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatProcessor.name);
  private timer: NodeJS.Timer | null = null;

  constructor(private prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => this.tick().catch((e) => this.logger.error(e)), 15 * 60 * 1000);
    setTimeout(() => this.tick().catch((e) => this.logger.error(e)), 30 * 1000);
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    const now = new Date();
    const list = await this.prisma.heartbeat.findMany({ include: { vault: true } });

    const overdue = list.filter((hb) => {
      const base = hb.lastPingAt ?? hb.createdAt;
      const due = addDays(new Date(base), Number(hb.timeoutDays ?? 60));
      return now > due;
    });

    if (!overdue.length) return;

    for (const hb of overdue) {
      try {
        await this.prisma.verificationEvent.create({
          data: {
            vaultId: hb.vaultId,
            state: 'HeartbeatTimeout' as any,
            quorumRequired: (hb as any).vault?.quorumThreshold ?? 3,
          },
        }).catch(() => Promise.resolve());
      } catch (e) {
        this.logger.warn(`Heartbeat timeout marking failed for vault ${hb.vaultId}: ${String(e)}`);
      }
    }

    this.logger.log(`Heartbeat sweep: overdue=${overdue.length}`);
  }
}
