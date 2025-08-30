import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ActorType } from '@prisma/client';

@Injectable()
export class AuditService {
  // keep logs for one year by default
  private readonly retentionMs = 365 * 24 * 3600 * 1000;

  constructor(private prisma: PrismaService) {}

  async log(
    actorType: ActorType,
    actorId: string,
    action: string,
    targetType?: string,
    targetId?: string,
    hash?: string,
  ) {
    await this.prisma.auditLog.create({
      data: {
        actorType,
        actorId,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        hash: hash ?? null,
      },
    });

    const cutoff = new Date(Date.now() - this.retentionMs);
    await this.prisma.auditLog.deleteMany({ where: { ts: { lt: cutoff } } });
  }
}

