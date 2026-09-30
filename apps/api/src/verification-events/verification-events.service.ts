import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
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

  /** asRole='verifier' — только события сейфов, где вызывающий активный верификатор (для кабинета верификатора). */
  async list(userId: string, vaultId?: string, asRole?: string) {
    if (asRole !== undefined && asRole !== 'verifier') {
      throw new BadRequestException('as must be "verifier"');
    }
    let vaultIds: string[];
    if (asRole === 'verifier') {
      const mine = await this.access.verifierVaultIds(userId);
      vaultIds = vaultId ? mine.filter((id) => id === vaultId) : mine;
    } else if (vaultId) {
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

  /** Возвращает обновлённое событие (id, state, confirmsCount, deniesCount), как и раньше, — клиент заменяет им элемент списка. */
  async decide(userId: string, eventId: string, decision: 'Confirm' | 'Deny', signature?: string) {
    await this.orchestrator.decideOnEvent(userId, eventId, decision, signature);
    const updated = await this.prisma.verificationEvent.findUnique({ where: { id: eventId } });
    if (!updated) throw new NotFoundException('Event not found');
    return updated;
  }
}
