import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { ActorType, Prisma } from '@prisma/client';

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
    tx?: Prisma.TransactionClient,
  ) {
    await (tx ?? this.prisma).auditLog.create({
      data: {
        actorType,
        actorId,
        action,
        targetType: targetType ?? null,
        targetId: targetId ?? null,
        hash: hash ?? null,
      },
    });

    // очистка по сроку хранения не выполняется внутри чужой транзакции (вынос из горячего пути — #168)
    if (tx) return;
    const cutoff = new Date(Date.now() - this.retentionMs);
    await this.prisma.auditLog.deleteMany({ where: { ts: { lt: cutoff } } });
  }
}

