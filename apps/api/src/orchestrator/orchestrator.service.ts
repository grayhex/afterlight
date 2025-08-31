import { Injectable, BadRequestException, ConflictException, ForbiddenException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { ActorType } from '@prisma/client';

type VState = 'Draft'|'Submitted'|'Confirming'|'Disputed'|'QuorumReached'|'HeartbeatTimeout'|'Grace'|'Finalized';
type VDecision = 'Confirm'|'Deny';

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);
  constructor(private prisma: PrismaService, private notify: NotificationsService, private audit: AuditService) {}

  private async getVaultOrThrow(userId: string, vaultId: string) {
    const v = await this.prisma.vault.findUnique({ where: { id: vaultId } });
    if (!v) throw new NotFoundException('Vault not found');
    if (v.userId !== userId) throw new ForbiddenException('Access denied');
    return v;
  }

  private async getActiveEvent(vaultId: string) {
    return this.prisma.verificationEvent.findFirst({
      where: { vaultId, state: { in: ['Submitted','Confirming'] as any } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async start(userId: string, vaultId: string) {
    const vault = await this.getVaultOrThrow(userId, vaultId);

    const frozen = await this.prisma.verificationEvent.findFirst({
      where: { vaultId, state: { in: ['Disputed','Grace'] as any } },
      orderBy: { createdAt: 'desc' },
    });
    if (frozen) throw new ConflictException('Event is frozen or in grace');

    const event = await this.prisma.verificationEvent.create({
      data: {
        vaultId,
        state: 'Submitted' as any,
        quorumRequired: (vault as any).quorumThreshold ?? 3,
      },
    });
    await this.audit.log(ActorType.User, userId, 'orchestrator_start', 'VerificationEvent', event.id);

    const roles = await this.prisma.vaultUserRole.findMany({
      where: { vaultId, status: 'Active' as any },
      include: { user: true },
    });
    for (const r of roles) {
      const to = r.user?.email;
      if (to)
        await this.notify.enqueueEmail(vaultId, to, {
          subject: 'AfterLight: начат процесс верификации',
          text: `Доверитель инициировал событие. Перейдите на сайт и примите решение.`,
        });
    }
    await this.notify.flushEmailQueue();

    await this.prisma.vault.update({ where: { id: vaultId }, data: { status: 'Triggered' as any } });

    return event;
  }

  private async recomputeAndTransition(eventId: string, now = new Date()) {
    const ev = await this.prisma.verificationEvent.findUnique({
      where: { id: eventId },
      include: { vault: true },
    });
    if (!ev) throw new NotFoundException('Event not found');

    const [confirms, denies] = await Promise.all([
      this.prisma.verificationDecision.count({
        where: { verificationEventId: ev.id, decision: 'Confirm' as any },
      }),
      this.prisma.verificationDecision.count({
        where: { verificationEventId: ev.id, decision: 'Deny' as any },
      }),
    ]);

    const quorum = ev.quorumRequired ?? (ev as any).vault?.quorumThreshold ?? 3;
    const ageMs = now.getTime() - new Date(ev.createdAt).getTime();

    // Grace → Finalized
    if (ev.state === ('Grace' as any)) {
      const graceHours = (ev as any).vault?.graceHours ?? 24;
      if (ageMs >= graceHours * 3600 * 1000) {
        await this.prisma.verificationEvent.update({
          where: { id: ev.id },
          data: { state: 'Finalized' as any },
        });
        await this.prisma.vault.update({
          where: { id: ev.vaultId },
          data: { status: 'Released' as any },
        });
        const owner = await this.prisma.user.findUnique({ where: { id: ev.vault.userId } });
        if (owner?.email) {
          await this.notify.enqueueEmail(ev.vaultId, owner.email, {
            subject: 'AfterLight: процесс завершён',
            text: 'Раскрытие инициировано (MVP без контента).',
          });
        }
        await this.notify.flushEmailQueue();
        return { state: 'Finalized', confirms, denies, quorum };
      }
    }

    // Disputed lock expiry → new Submitted
    if (ev.state === ('Disputed' as any)) {
      if (ageMs >= 24 * 3600 * 1000) {
        await this.prisma.verificationEvent.create({
          data: {
            vaultId: ev.vaultId,
            state: 'Submitted' as any,
            quorumRequired:
              (ev as any).quorumRequired ?? (ev as any).vault?.quorumThreshold ?? 3,
          },
        });
        return { state: 'Submitted', confirms, denies, quorum };
      }
      return { state: 'Disputed', confirms, denies, quorum };
    }

    if (confirms > 0 && denies > 0) {
      if (ev.state !== ('Disputed' as any)) {
        await this.prisma.verificationEvent.update({
          where: { id: ev.id },
          data: { state: 'Disputed' as any },
        });
        const owner = await this.prisma.user.findUnique({
          where: { id: ev.vault.userId },
        });
        if (owner?.email) {
          await this.notify.enqueueEmail(ev.vaultId, owner.email, {
            subject: 'AfterLight: спор подтверждений',
            text: `Возник конфликт подтверждений. Процесс заморожен на 24 часа.`,
          });
          await this.notify.flushEmailQueue();
        }
      }
      return { state: 'Disputed', confirms, denies, quorum };
    }

    if (confirms >= quorum) {
      if (ev.state !== ('QuorumReached' as any) && ev.state !== ('Grace' as any)) {
        await this.prisma.verificationEvent.update({
          where: { id: ev.id },
          data: { state: 'QuorumReached' as any },
        });
        const owner = await this.prisma.user.findUnique({
          where: { id: ev.vault.userId },
        });
        const roles = await this.prisma.vaultUserRole.findMany({
          where: { vaultId: ev.vaultId, status: 'Active' as any },
          include: { user: true },
        });
        if (owner?.email) {
          await this.notify.enqueueEmail(ev.vaultId, owner.email, {
            subject: 'AfterLight: Кворум достигнут',
            text: 'Кворум подтверждений достигнут.',
          });
        }
        for (const r of roles) {
          const to = r.user?.email;
          if (to)
            await this.notify.enqueueEmail(ev.vaultId, to, {
              subject: 'AfterLight: Кворум достигнут',
              text: 'Кворум подтверждений достигнут.',
            });
        }
        await this.notify.flushEmailQueue();
        return { state: 'QuorumReached', confirms, denies, quorum };
      }
      if (ev.state === ('QuorumReached' as any)) {
        await this.prisma.verificationEvent.update({
          where: { id: ev.id },
          data: { state: 'Grace' as any },
        });
        await this.prisma.vault.update({
          where: { id: ev.vaultId },
          data: { status: 'PendingGrace' as any },
        });
        const owner = await this.prisma.user.findUnique({
          where: { id: ev.vault.userId },
        });
        const roles = await this.prisma.vaultUserRole.findMany({
          where: { vaultId: ev.vaultId, status: 'Active' as any },
          include: { user: true },
        });
        const graceHours = (ev as any).vault?.graceHours ?? 24;
        const until = new Date(now.getTime() + graceHours * 3600 * 1000).toISOString();
        if (owner?.email)
          await this.notify.enqueueEmail(ev.vaultId, owner.email, {
            subject: 'AfterLight: Grace period',
            text: `Начался grace‑период. Завершение не ранее ${until}.`,
          });
        for (const r of roles) {
          const to = r.user?.email;
          if (to)
            await this.notify.enqueueEmail(ev.vaultId, to, {
              subject: 'AfterLight: Grace period',
              text: `Начался grace‑период до ${until}.`,
            });
        }
        await this.notify.flushEmailQueue();
        return { state: 'Grace', confirms, denies, quorum };
      }
      return { state: 'Grace', confirms, denies, quorum };
    }

    const next: VState = confirms > 0 ? 'Confirming' : 'Submitted';
    if (ev.state !== (next as any)) {
      await this.prisma.verificationEvent.update({
        where: { id: ev.id },
        data: { state: next as any },
      });
    }
    return { state: next, confirms, denies, quorum };
  }

  async decide(actorId: string, vaultId: string, userId: string, decision: VDecision, signature?: string) {
    const frozen = await this.prisma.verificationEvent.findFirst({
      where: { vaultId, state: 'Disputed' as any },
      orderBy: { createdAt: 'desc' },
    });
    if (frozen) {
      const ageMs = Date.now() - new Date(frozen.createdAt).getTime();
      if (ageMs < 24 * 3600 * 1000) {
        throw new ConflictException('Event in Disputed lock (24h)');
      }
    }

    const active = await this.getActiveEvent(vaultId);
    if (!active) throw new BadRequestException('No active event to accept decisions');

    const hasRight = await this.prisma.vaultUserRole.findFirst({
      where: { vaultId, userId, status: 'Active' as any },
    });
    if (!hasRight) throw new ForbiddenException('Verifier is not active for this vault');

    const existing = await this.prisma.verificationDecision.findFirst({
      where: { verificationEventId: active.id, userId },
    });
    if (existing) {
      await this.prisma.verificationDecision.update({
        where: { id: existing.id },
        data: { decision: decision as any, signature: signature ?? undefined },
      });
    } else {
      await this.prisma.verificationDecision.create({
        data: {
          verificationEventId: active.id,
          userId,
          decision: decision as any,
          signature: signature ?? null,
        },
      });
    }
    await this.audit.log(
      ActorType.User,
      actorId,
      `orchestrator_decide:${decision}`,
      'VerificationEvent',
      active.id,
    );
    return this.recomputeAndTransition(active.id, new Date());
  }
  
  async processTimers(now = new Date()) {
    let finalized = 0, unlocked = 0;

    const events = await this.prisma.verificationEvent.findMany({
      where: { state: { in: ['QuorumReached', 'Grace', 'Disputed'] as any } },
    });
    for (const ev of events) {
      const res = await this.recomputeAndTransition(ev.id, now);
      if (ev.state === ('Disputed' as any) && res.state === 'Submitted') unlocked++;
      if (res.state === 'Finalized') finalized++;
    }

    return { finalized, unlocked };
  }
}
