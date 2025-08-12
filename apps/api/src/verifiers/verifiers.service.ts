import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InviteVerifierDto } from './dto/invite-verifier.dto';

@Injectable()
export class VerifiersService {
  constructor(private prisma: PrismaService) {}

  async listByVault(vaultId: string) {
    return this.prisma.vaultVerifier.findMany({
      where: { vaultId },
      include: { verifier: true },
      orderBy: { addedAt: 'desc' },
    });
  }

  async invite(dto: InviteVerifierDto) {
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

    return { invitation: link, token: 'todo-token' };
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
