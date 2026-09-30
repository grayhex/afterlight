import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateRecoveryShareDto } from './dto/create-recovery-share.dto.js';
import { UpdateRecoveryShareDto } from './dto/update-recovery-share.dto.js';
import { VaultAccessService } from '../vault-access/vault-access.service.js';

/** Доли восстановления — ключевой материал: доступны только владельцу соответствующего сейфа. */
@Injectable()
export class RecoverySharesService {
  constructor(private prisma: PrismaService, private access: VaultAccessService) {}

  private async getOwned(userId: string, id: string) {
    const share = await this.prisma.recoveryShare.findUnique({ where: { id } });
    if (!share) throw new NotFoundException('Recovery share not found');
    await this.access.assertOwner(userId, share.vaultId);
    return share;
  }

  async list(userId: string, vaultId: string) {
    await this.access.assertOwner(userId, vaultId);
    return this.prisma.recoveryShare.findMany({ where: { vaultId } });
  }

  get(userId: string, id: string) {
    return this.getOwned(userId, id);
  }

  async create(userId: string, dto: CreateRecoveryShareDto) {
    await this.access.assertOwner(userId, dto.vaultId);
    return this.prisma.recoveryShare.create({ data: dto });
  }

  async update(userId: string, id: string, dto: UpdateRecoveryShareDto) {
    await this.getOwned(userId, id);
    // Перенос доли в другой сейф этим маршрутом не допускается.
    if (dto.vaultId !== undefined) throw new ForbiddenException('vaultId cannot be changed');
    return this.prisma.recoveryShare.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.getOwned(userId, id);
    return this.prisma.recoveryShare.delete({ where: { id } });
  }
}
