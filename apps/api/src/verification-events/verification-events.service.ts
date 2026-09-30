import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrchestratorService } from '../orchestrator/orchestrator.service';
import { VaultAccessService } from '../vault-access/vault-access.service';

/**
 * Тонкий слой над оркестратором: ни запуск, ни голосование не реализованы здесь отдельно,
 * поэтому второго пути с другими проверками нет.
 */
@Injectable()
export class VerificationEventsService {
  constructor(
    private prisma: PrismaService,
    private orchestrator: OrchestratorService,
    private access: VaultAccessService,
  ) {}

  async list(userId: string, vaultId?: string) {
    let vaultIds: string[];
    if (vaultId) {
      await this.access.assertCanReadEvents(userId, vaultId);
      vaultIds = [vaultId];
    } else {
      vaultIds = await this.access.readableVaultIds(userId);
    }
    if (vaultIds.length === 0) return [];
    return this.prisma.verificationEvent.findMany({
      where: { vaultId: { in: vaultIds } },
      orderBy: { createdAt: 'desc' },
    });
  }

  start(userId: string, vaultId: string) {
    return this.orchestrator.start(userId, vaultId);
  }

  async get(userId: string, id: string) {
    const event = await this.prisma.verificationEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('Event not found');
    await this.access.assertCanReadEvents(userId, event.vaultId);
    return event;
  }

  decide(userId: string, eventId: string, decision: 'Confirm' | 'Deny', signature?: string) {
    return this.orchestrator.decideOnEvent(userId, eventId, decision, signature);
  }
}
