import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerifiersService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  async listByVault(vaultId: string) {
    return this.prisma.vaultUserRole.findMany({
      where: { vaultId },
      include: { user: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async invite(dto: InviteVerifierDto, token: string) {
    const user = await this.prisma.user.upsert({
      where: { email: dto.email },
      update: {},
      create: { email: dto.email, role: 'Verifier' },
    });

    const existing = await this.prisma.vaultUserRole.findUnique({
      where: { vaultId_userId: { vaultId: dto.vault_id, userId: user.id } },
    });
    if (existing) throw new BadRequestException('Already invited');

    const link = await this.prisma.vaultUserRole.create({
      data: {
        vaultId: dto.vault_id,
        userId: user.id,
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

  async acceptInvitation(vaultId: string, userId: string) {
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
