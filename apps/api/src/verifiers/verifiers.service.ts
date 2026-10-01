import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { InviteVerifierDto } from './dto/invite-verifier.dto.js';
import { InvitationCreatedDto, VerifierMemberDto } from './dto/verifier-member.dto.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AuditService } from '../audit/audit.service.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';
import { AuthenticatedUser } from '../common/current-user.decorator.js';

export const hashInvitationToken = (token: string) => createHash('sha256').update(token).digest('hex');
const normalizeEmail = (email: string) => email.trim().toLowerCase();

@Injectable()
export class VerifiersService {
  constructor(
    private prisma: PrismaService,
    private notify: NotificationsService,
    private audit: AuditService,
    private access: VaultAccessService,
  ) {}

  async listByVault(user: AuthenticatedUser, vaultId: string): Promise<VerifierMemberDto[]> {
    await this.access.assertManager(user.sub, vaultId);

    const roles = await this.prisma.vaultUserRole.findMany({
      where: { vaultId },
      include: { user: { select: { id: true, email: true, name: true } } },
      orderBy: { addedAt: 'desc' },
    });
    const pending = await this.prisma.vaultUserInvitation.findMany({
      where: { vaultId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });

    // Явный список полей: связанная модель User содержит passwordHash и другие внутренние данные.
    const members: VerifierMemberDto[] = roles.map((r) => ({
      user_id: r.userId,
      invitation_id: null,
      email: r.user.email,
      name: r.user.name ?? null,
      role: r.role,
      status: r.status,
      is_primary: r.isPrimary,
      expires_at: null,
      added_at: r.addedAt,
    }));
    const invited: VerifierMemberDto[] = pending.map((i) => ({
      user_id: null,
      invitation_id: i.id,
      email: i.email,
      name: null,
      role: i.role,
      status: 'Invited',
      is_primary: false,
      expires_at: i.expiresAt,
      added_at: i.createdAt,
    }));
    return [...invited, ...members];
  }

  async invite(user: AuthenticatedUser, dto: InviteVerifierDto): Promise<InvitationCreatedDto> {
    const vault = await this.access.assertManager(user.sub, dto.vault_id);
    // D4: состав верификаторов не меняется во время процесса
    await this.access.assertNoActiveEvent(vault.id);
    const email = normalizeEmail(dto.email);

    const owner = await this.prisma.user.findUnique({ where: { id: vault.userId } });
    if (owner && normalizeEmail(owner.email) === email) {
      throw new BadRequestException('Vault owner cannot be invited as a verifier');
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      const link = await this.prisma.vaultUserRole.findUnique({
        where: { vaultId_userId: { vaultId: vault.id, userId: existingUser.id } },
      });
      if (link && link.status !== 'Revoked') throw new ConflictException('Already a member of this vault');
    }

    const open = await this.prisma.vaultUserInvitation.findFirst({
      where: { vaultId: vault.id, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (open) throw new ConflictException('Already invited');

    // Токен знает только получатель письма: в БД лежит хэш, в ответе API токена нет.
    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + (dto.expires_in_hours ?? 168) * 3600 * 1000);
    const invitation = await this.prisma.vaultUserInvitation.create({
      data: {
        vaultId: vault.id,
        email,
        role: 'Verifier',
        token: hashInvitationToken(token),
        expiresAt,
        invitedBy: user.sub,
      },
    });

    await this.notify.sendVerifierInvitation(vault.id, email, token);
    await this.audit.log(ActorType.User, user.sub, 'verifier_invite', 'Vault', vault.id);

    return { id: invitation.id, email, role: invitation.role, expires_at: expiresAt };
  }

  /**
   * Принять приглашение может только вошедший пользователь, чей email совпадает с адресатом,
   * по действующему одноразовому токену. Активируется только собственное участие.
   */
  async acceptInvitation(user: AuthenticatedUser, token: string): Promise<VerifierMemberDto> {
    const invitation = await this.prisma.vaultUserInvitation.findUnique({
      where: { token: hashInvitationToken(token) },
    });
    if (!invitation) throw new NotFoundException('Invitation not found');

    const account = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!account) throw new UnauthorizedException();
    if (normalizeEmail(account.email) !== normalizeEmail(invitation.email)) {
      throw new ForbiddenException('Invitation was issued for another address');
    }

    const vault = await this.prisma.vault.findUnique({ where: { id: invitation.vaultId } });
    if (!vault) throw new NotFoundException('Invitation not found');
    if (vault.userId === account.id) {
      throw new BadRequestException('Vault owner cannot be a verifier');
    }

    const now = new Date();
    const link = await this.prisma.$transaction(async (tx) => {
      // D4: во время процесса состав не меняется — принять приглашение можно после его завершения или отмены
      await this.access.lockVaultAssertNoActiveEvent(tx, invitation.vaultId);
      // Условное обновление делает "использовать один раз" атомарным при параллельных запросах.
      const claimed = await tx.vaultUserInvitation.updateMany({
        where: { id: invitation.id, acceptedAt: null, revokedAt: null, expiresAt: { gt: now } },
        data: { acceptedAt: now },
      });
      if (claimed.count !== 1) throw new GoneException('Invitation is no longer valid');

      return tx.vaultUserRole.upsert({
        where: { vaultId_userId: { vaultId: invitation.vaultId, userId: account.id } },
        create: { vaultId: invitation.vaultId, userId: account.id, role: invitation.role, status: 'Active', isPrimary: false },
        // Роль перезаписывается ролью из приглашения: повторное приглашение отозванного не восстанавливает прежние права.
        update: { role: invitation.role, status: 'Active' },
      });
    });

    await this.audit.log(ActorType.User, account.id, 'verifier_invitation_accept', 'Vault', invitation.vaultId);

    return {
      user_id: link.userId,
      invitation_id: null,
      email: account.email,
      name: account.name ?? null,
      role: link.role,
      status: link.status,
      is_primary: link.isPrimary,
      expires_at: null,
      added_at: link.addedAt,
    };
  }

  async revokeInvitation(user: AuthenticatedUser, invitationId: string) {
    const invitation = await this.prisma.vaultUserInvitation.findUnique({ where: { id: invitationId } });
    if (!invitation) throw new NotFoundException('Invitation not found');
    await this.access.assertManager(user.sub, invitation.vaultId);
    await this.prisma.vaultUserInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log(ActorType.User, user.sub, 'verifier_invitation_revoke', 'Vault', invitation.vaultId);
    return { status: 'ok' };
  }

  async revokeMember(user: AuthenticatedUser, vaultId: string, memberUserId: string) {
    const vault = await this.access.assertManager(user.sub, vaultId);
    if (vault.userId === memberUserId) throw new BadRequestException('Vault owner cannot be revoked');
    await this.prisma.$transaction(async (tx) => {
      await this.access.lockVaultAssertNoActiveEvent(tx, vaultId);
      const link = await tx.vaultUserRole.findUnique({
        where: { vaultId_userId: { vaultId, userId: memberUserId } },
      });
      if (!link) throw new NotFoundException('Member not found');
      await tx.vaultUserRole.update({
        where: { vaultId_userId: { vaultId, userId: memberUserId } },
        data: { status: 'Revoked', isPrimary: false },
      });
    });
    await this.audit.log(ActorType.User, user.sub, 'verifier_revoke', 'Vault', vaultId);
    return { status: 'ok' };
  }
}
