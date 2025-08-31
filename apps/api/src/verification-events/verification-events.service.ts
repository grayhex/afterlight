import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StartVerificationEventDto } from './dto/start-event.dto';
import { DecisionDto } from './dto/decision.dto';

@Injectable()
export class VerificationEventsService {
  constructor(private prisma: PrismaService) {}

  async listByVault(vaultId: string) {
    return this.prisma.verificationEvent.findMany({
      where: { vaultId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async start(dto: StartVerificationEventDto) {
    const v = await this.prisma.vault.findUnique({ where: { id: dto.vault_id } });
    if (!v) throw new NotFoundException('Vault not found');
    return this.prisma.verificationEvent.create({
      data: {
        vaultId: dto.vault_id,
        state: 'Submitted',
        quorumRequired: v.quorumThreshold,
      },
    });
  }

  async get(id: string) {
    const e = await this.prisma.verificationEvent.findUnique({ where: { id } });
    if (!e) throw new NotFoundException('Event not found');
    return e;
  }

  async decide(id: string, userId: string, dto: DecisionDto) {
    const event = await this.get(id);
    await this.prisma.verificationDecision.upsert({
      where: { verificationEventId_userId: { verificationEventId: id, userId } },
      create: {
        verificationEventId: id,
        userId,
        decision: dto.decision,
        signature: dto.signature,
      },
      update: { decision: dto.decision, signature: dto.signature },
    });

    const decisions = await this.prisma.verificationDecision.groupBy({
      by: ['decision'],
      where: { verificationEventId: id },
      _count: { decision: true },
    });

    const confirms = decisions.find(d => d.decision === 'Confirm')?._count.decision ?? 0;
    const denies = decisions.find(d => d.decision === 'Deny')?._count.decision ?? 0;

    let newState = event.state;
    if (confirms >= event.quorumRequired) {
      newState = 'QuorumReached';
    } else if (confirms > 0 && denies > 0) {
      newState = 'Disputed';
    } else if (confirms > 0) {
      newState = 'Confirming';
    }

    return this.prisma.verificationEvent.update({
      where: { id },
      data: { confirmsCount: confirms, deniesCount: denies, state: newState },
    });
  }
}
