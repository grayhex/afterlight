import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipientDto } from './dto/create-recipient.dto';
import { AuthenticatedUser } from '../common/current-user.decorator';

@Injectable()
export class RecipientsService {
  constructor(private prisma: PrismaService) {}

  private async ensureVaultAccess(userId: string, vaultId: string) {
    const ownedVault = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (ownedVault) return;

    const link = await this.prisma.vaultUserRole.findFirst({
      where: {
        vaultId,
        userId,
        status: 'Active',
        role: { in: [UserRole.Admin, UserRole.Owner, UserRole.Verifier] },
      },
    });
    if (!link) {
      throw new ForbiddenException('Vault not found or access denied');
    }
  }

  async createOrGet(user: AuthenticatedUser, dto: CreateRecipientDto) {
    await this.ensureVaultAccess(user.sub, dto.vault_id);

    const r = await this.prisma.recipient.upsert({
      where: { contact: dto.contact },
      update: { pubkey: dto.pubkey ?? undefined },
      create: { contact: dto.contact, pubkey: dto.pubkey ?? null, verificationStatus: 'Invited' as any },
    });
    return r;
  }

  async search(user: AuthenticatedUser, vaultId: string, query?: string) {
    await this.ensureVaultAccess(user.sub, vaultId);

    const where = query
      ? { contact: { contains: query, mode: 'insensitive' as const } }
      : {};
    return this.prisma.recipient.findMany({
      where: {
        ...where,
        blocks: {
          some: {
            block: {
              vaultId,
            },
          },
        },
      },
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  }
}
