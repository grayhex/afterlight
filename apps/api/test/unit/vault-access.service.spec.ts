import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ForbiddenException } from '@nestjs/common';
import { VaultAccessService } from '../../src/vault-access/vault-access.service.js';

/**
 * Правила доступа к сейфу в одном месте (VaultAccessService). Здесь — только логика выбора ролей и статусов на моках;
 * то же самое с настоящей БД и guard'ами проверяют integration-тесты (object-authorization.spec.ts).
 */
describe('VaultAccessService', () => {
  type Link = { vaultId: string; userId: string; role: 'Owner' | 'Admin' | 'Verifier'; status: 'Invited' | 'Active' | 'Revoked' };
  let vaults: Array<{ id: string; userId: string }>;
  let links: Link[];
  let service: VaultAccessService;

  /** Минимальная in-memory реализация нужных запросов Prisma: фильтры по равенству и `in`. */
  const matches = (row: any, where: any): boolean =>
    Object.entries(where ?? {}).every(([k, v]) => {
      if (v && typeof v === 'object' && 'in' in (v as any)) return (v as any).in.includes(row[k]);
      return row[k] === v;
    });

  beforeEach(() => {
    vaults = [{ id: 'v1', userId: 'owner' }, { id: 'v2', userId: 'other-owner' }];
    links = [];
    const prisma: any = {
      vault: {
        findFirst: jest.fn(async ({ where }: any) => vaults.find((v) => matches(v, where)) ?? null),
        findUnique: jest.fn(async ({ where }: any) => vaults.find((v) => matches(v, where)) ?? null),
        findMany: jest.fn(async ({ where }: any) => vaults.filter((v) => matches(v, where))),
      },
      vaultUserRole: {
        findFirst: jest.fn(async ({ where }: any) => links.find((l) => matches(l, where)) ?? null),
        findMany: jest.fn(async ({ where }: any) => links.filter((l) => matches(l, where))),
      },
      verificationEvent: { findFirst: jest.fn(async () => null) },
    };
    service = new VaultAccessService(prisma);
  });

  const link = (userId: string, role: Link['role'], status: Link['status'], vaultId = 'v1') => links.push({ vaultId, userId, role, status });
  const denies = async (p: Promise<unknown>) => {
    await expect(p).rejects.toBeInstanceOf(ForbiddenException);
    await expect(p).rejects.toThrow('Vault not found or access denied');
  };

  describe('assertOwner', () => {
    it('lets only the vault owner through; a manager role in VaultUserRole is not ownership', async () => {
      await expect(service.assertOwner('owner', 'v1')).resolves.toMatchObject({ id: 'v1' });
      link('admin-user', 'Admin', 'Active');
      link('owner-role', 'Owner', 'Active');
      for (const who of ['admin-user', 'owner-role', 'other-owner', 'stranger']) await denies(service.assertOwner(who, 'v1'));
    });

    it('answers the same for a missing vault and for somebody else\'s vault (no existence leak)', async () => {
      const foreign = service.assertOwner('owner', 'v2');
      const missing = service.assertOwner('owner', 'nope');
      await expect(foreign).rejects.toThrow('Vault not found or access denied');
      await expect(missing).rejects.toThrow('Vault not found or access denied');
    });
  });

  describe('assertManager', () => {
    it('allows the owner and an active Owner/Admin role; denies Verifier and non-active statuses', async () => {
      link('admin-user', 'Admin', 'Active');
      link('owner-role', 'Owner', 'Active');
      link('verifier', 'Verifier', 'Active');
      link('invited-admin', 'Admin', 'Invited');
      link('revoked-admin', 'Admin', 'Revoked');
      link('revoked-owner-role', 'Owner', 'Revoked');
      for (const who of ['owner', 'admin-user', 'owner-role']) await expect(service.assertManager(who, 'v1')).resolves.toMatchObject({ id: 'v1' });
      for (const who of ['verifier', 'invited-admin', 'revoked-admin', 'revoked-owner-role', 'other-owner', 'stranger']) await denies(service.assertManager(who, 'v1'));
    });

    it('a role in one vault gives nothing in another', async () => {
      link('admin-user', 'Admin', 'Active', 'v2');
      await denies(service.assertManager('admin-user', 'v1'));
      await expect(service.assertManager('admin-user', 'v2')).resolves.toMatchObject({ id: 'v2' });
    });
  });

  describe('assertActiveVerifier', () => {
    it('only an Active Verifier passes; the owner, Invited and Revoked do not', async () => {
      link('v-active', 'Verifier', 'Active');
      link('v-invited', 'Verifier', 'Invited');
      link('v-revoked', 'Verifier', 'Revoked');
      link('admin-user', 'Admin', 'Active');
      await expect(service.assertActiveVerifier('v-active', 'v1')).resolves.toMatchObject({ userId: 'v-active' });
      for (const who of ['v-invited', 'v-revoked', 'admin-user', 'owner', 'stranger']) {
        await expect(service.assertActiveVerifier(who, 'v1')).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  });

  describe('assertCanReadEvents', () => {
    it('allows the owner and active Owner/Admin/Verifier members, not invited, revoked or outsiders', async () => {
      link('v-active', 'Verifier', 'Active');
      link('admin-user', 'Admin', 'Active');
      link('v-invited', 'Verifier', 'Invited');
      link('v-revoked', 'Verifier', 'Revoked');
      for (const who of ['owner', 'v-active', 'admin-user']) await expect(service.assertCanReadEvents(who, 'v1')).resolves.toBeUndefined();
      for (const who of ['v-invited', 'v-revoked', 'other-owner', 'stranger']) await denies(service.assertCanReadEvents(who, 'v1'));
    });
  });

  describe('assertCanStartEvent', () => {
    it('owner and managers start as themselves, an active verifier starts as a verifier (inactivity threshold applies)', async () => {
      link('admin-user', 'Admin', 'Active');
      link('v-active', 'Verifier', 'Active');
      await expect(service.assertCanStartEvent('owner', 'v1')).resolves.toMatchObject({ asVerifier: false });
      await expect(service.assertCanStartEvent('admin-user', 'v1')).resolves.toMatchObject({ asVerifier: false });
      await expect(service.assertCanStartEvent('v-active', 'v1')).resolves.toMatchObject({ asVerifier: true });
    });

    it('invited, revoked and unrelated users cannot start', async () => {
      link('v-invited', 'Verifier', 'Invited');
      link('v-revoked', 'Verifier', 'Revoked');
      for (const who of ['v-invited', 'v-revoked', 'stranger', 'other-owner']) {
        await expect(service.assertCanStartEvent(who, 'v1')).rejects.toBeInstanceOf(ForbiddenException);
      }
    });
  });

  describe('readableVaultIds / verifierVaultIds', () => {
    it('lists own vaults plus vaults where the user is an active member; never invited or revoked ones', async () => {
      link('person', 'Verifier', 'Active', 'v1');
      link('person', 'Verifier', 'Invited', 'v2');
      expect(await service.readableVaultIds('person')).toEqual(['v1']);
      link('person', 'Verifier', 'Revoked', 'v2');
      expect(await service.readableVaultIds('person')).toEqual(['v1']);
      expect((await service.readableVaultIds('owner')).sort()).toEqual(['v1']);
    });

    it('does not repeat a vault the user both owns and is a member of', async () => {
      link('owner', 'Admin', 'Active', 'v1');
      expect(await service.readableVaultIds('owner')).toEqual(['v1']);
    });

    it('verifierVaultIds counts only active Verifier roles, not the owner\'s own vaults or manager roles', async () => {
      link('person', 'Verifier', 'Active', 'v1');
      link('person', 'Admin', 'Active', 'v2');
      link('person', 'Verifier', 'Revoked', 'v2');
      expect(await service.verifierVaultIds('person')).toEqual(['v1']);
      expect(await service.verifierVaultIds('owner')).toEqual([]);
    });
  });
});
