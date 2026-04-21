import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRole, VaultUserRoleStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthenticatedUser } from '../common/current-user.decorator';

@Injectable()
export class VerifiersService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  private async ensureVaultAccess(
    userId: string,
    vaultId: string,
    statuses: VaultUserRoleStatus[] = ['Active'],
  ) {
    const ownedVault = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (ownedVault) return;

    const link = await this.prisma.vaultUserRole.findFirst({
      where: {
        vaultId,
        userId,
        status: { in: statuses },
        role: { in: [UserRole.Admin, UserRole.Owner, UserRole.Verifier] },
      },
    });

    if (!link) {
      throw new ForbiddenException('Vault not found or access denied');
    }
  }

  async listByVault(user: AuthenticatedUser, vaultId: string) {
    await this.ensureVaultAccess(user.sub, vaultId);
    return this.prisma.vaultUserRole.findMany({
      where: { vaultId },
      include: { user: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async invite(user: AuthenticatedUser, dto: InviteVerifierDto, token: string) {
    await this.ensureVaultAccess(user.sub, dto.vault_id);

    const invitedUser = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {},
      create: { email: dto.email, role: 'Verifier' },
    });

    const existing = await this.prisma.vaultUserRole.findUnique({
      where: { vaultId_userId: { vaultId: dto.vault_id, userId: invitedUser.id } },
    });
    if (existing) throw new BadRequestException('Already invited');

    const link = await this.prisma.vaultUserRole.create({
      data: {
        vaultId: dto.vault_id,
        userId: invitedUser.id,
        role: 'Verifier',
        status: 'Invited',
        isPrimary: false,
      },
      include: { user: true },
    });

    const expiresAt = new Date(
      Date.now() + (dto.expires_in_hours ?? 168) * 3600 * 1000,
    );
    await this.prisma.vaultUserInvitation.create({
      data: {
        vaultId: dto.vault_id,
        email: dto.email,
        role: 'Verifier',
        token,
        expiresAt,
      },
    });

    await this.notify.sendVerifierInvitation(dto.vault_id, dto.email, token);

    return { invitation: link, token };
  }

  async acceptInvitation(user: AuthenticatedUser, vaultId: string, userId: string) {
    await this.ensureVaultAccess(user.sub, vaultId, ['Active', 'Invited']);

    const link = await this.prisma.vaultUserRole.findUnique({
      where: { vaultId_userId: { vaultId, userId } },
    });
    if (!link) throw new NotFoundException('Invitation not found');
    if (link.status === 'Active') return link;

    return this.prisma.vaultUserRole.update({
      where: { vaultId_userId: { vaultId, userId } },
      data: { status: 'Active' },
    });
  }
}
