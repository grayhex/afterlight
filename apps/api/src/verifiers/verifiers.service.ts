import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class VerifiersService {
  constructor(private prisma: PrismaService, private notify: NotificationsService) {}

  async listByVault(vaultId: string) {
    return this.prisma.vaultVerifier.findMany({
      where: { vaultId },
      include: { verifier: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async invite(dto: InviteVerifierDto, token: string) {
    const verifier = await this.prisma.verifier.upsert({
      where: { contact: dto.contact },
      update: {},
      create: { contact: dto.contact, kycLevel: 'None' },
    });

    const existing = await this.prisma.vaultVerifier.findUnique({
      where: { vaultId_verifierId: { vaultId: dto.vault_id, verifierId: verifier.id } },
    });
    if (existing) throw new BadRequestException('Already invited');

    const link = await this.prisma.vaultVerifier.create({
      data: {
        vaultId: dto.vault_id,
        verifierId: verifier.id,
        roleStatus: 'Invited',
        isPrimary: false,
      },
      include: { verifier: true },
    });

    const expiresAt = new Date(Date.now() + (dto.expires_in_hours ?? 168) * 3600 * 1000);
    await this.prisma.verifierInvitation.create({
      data: {
        vaultId: dto.vault_id,
        email: dto.contact,
        token,
        expiresAt,
      },
    });

    await this.notify.sendVerifierInvitation(dto.vault_id, dto.contact, token);

    return { invitation: link, token };
  }

  async acceptInvitation(vaultId: string, verifierId: string) {
    const link = await this.prisma.vaultVerifier.findUnique({
      where: { vaultId_verifierId: { vaultId, verifierId } },
    });
    if (!link) throw new NotFoundException('Invitation not found');
    if (link.roleStatus === 'Active') return link;

    return this.prisma.vaultVerifier.update({
      where: { vaultId_verifierId: { vaultId, verifierId } },
      data: { roleStatus: 'Active' },
    });
  }
}
