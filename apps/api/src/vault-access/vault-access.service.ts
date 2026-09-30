import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const DENIED = 'Vault not found or access denied';

/**
 * Единственное место, где решается, что пользователь может делать в конкретном сейфе.
 * Глобальная роль пользователя и сам факт входа права на сейф не дают.
 * Для несуществующего сейфа и для чужого сейфа ответ одинаковый (не раскрываем существование).
 */
@Injectable()
export class VaultAccessService {
  constructor(private prisma: PrismaService) {}

  /** Владелец сейфа (vault.userId). */
  async assertOwner(userId: string, vaultId: string) {
    const vault = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (!vault) throw new ForbiddenException(DENIED);
    return vault;
  }

  /**
   * Право управлять сейфом: участниками, получателями, запуском процесса.
   * Владелец либо активный участник с явной ролью Owner/Admin. Роль Verifier этого права не даёт.
   */
  async assertManager(userId: string, vaultId: string) {
    const owned = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (owned) return owned;
    const link = await this.prisma.vaultUserRole.findFirst({
      where: {
        vaultId,
        userId,
        status: 'Active',
        role: { in: [UserRole.Owner, UserRole.Admin] },
      },
    });
    if (!link) throw new ForbiddenException(DENIED);
    const vault = await this.prisma.vault.findUnique({ where: { id: vaultId } });
    if (!vault) throw new ForbiddenException(DENIED);
    return vault;
  }

  /** Активный верификатор этого сейфа: Invited и Revoked не проходят. */
  async assertActiveVerifier(userId: string, vaultId: string) {
    const link = await this.prisma.vaultUserRole.findFirst({
      where: { vaultId, userId, status: 'Active', role: UserRole.Verifier },
    });
    if (!link) throw new ForbiddenException('Verifier is not active for this vault');
    return link;
  }

  /** Читать данные процесса может владелец/управляющий или активный верификатор. */
  async assertCanReadEvents(userId: string, vaultId: string) {
    const owned = await this.prisma.vault.findFirst({ where: { id: vaultId, userId } });
    if (owned) return;
    const link = await this.prisma.vaultUserRole.findFirst({
      where: {
        vaultId,
        userId,
        status: 'Active',
        role: { in: [UserRole.Owner, UserRole.Admin, UserRole.Verifier] },
      },
    });
    if (!link) throw new ForbiddenException(DENIED);
  }

  /** Сейфы, события которых пользователь вправе читать. */
  async readableVaultIds(userId: string): Promise<string[]> {
    const [owned, links] = await Promise.all([
      this.prisma.vault.findMany({ where: { userId } }),
      this.prisma.vaultUserRole.findMany({
        where: { userId, status: 'Active', role: { in: [UserRole.Owner, UserRole.Admin, UserRole.Verifier] } },
      }),
    ]);
    return [...new Set([...owned.map((v) => v.id), ...links.map((l) => l.vaultId)])];
  }
}
