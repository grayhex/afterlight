import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrapApp, closeApp, Ctx, SAMPLE } from './helper.js';

/**
 * Негативные тесты объектной авторизации остальных модулей (#164): настоящее приложение, настоящие guard'ы,
 * PostgreSQL, синтетические аккаунты. Участник одного сейфа ничего не получает в чужом; роль — только в своём сейфе.
 */
const UUID = '11111111-1111-4111-8111-111111111111';

describe('object authorization across modules (real guards, PostgreSQL)', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  async function scene() {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    const vault = await ctx.factory.createVault(owner.id);
    const block = await ctx.db.block.create({ data: { vaultId: vault.id, type: 'text', dekWrapped: 'dek', tags: ['t'] } });
    const active = await ctx.factory.createVerifier(vault.id, { status: 'Active' });
    const invited = await ctx.factory.createVerifier(vault.id, { status: 'Invited' });
    const revoked = await ctx.factory.createVerifier(vault.id, { status: 'Revoked' });
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const other = await ctx.factory.createUser({ email: 'other-owner@test.local' });
    const otherVault = await ctx.factory.createVault(other.id);
    const otherBlock = await ctx.db.block.create({ data: { vaultId: otherVault.id, type: 'text', dekWrapped: 'dek', tags: [] } });
    const admin = await ctx.factory.createUser({ email: 'admin@test.local', role: 'Admin' });
    return { owner, vault, block, active, invited, revoked, outsider, other, otherVault, otherBlock, admin };
  }
  type Scene = Awaited<ReturnType<typeof scene>>;
  /** Все, кто не владелец этого сейфа: у каждого своя причина не иметь доступа. */
  const nonOwners = (s: Scene) => ({
    'active verifier': s.active.user.id,
    'invited verifier': s.invited.user.id,
    'revoked verifier': s.revoked.user.id,
    'outsider': s.outsider.id,
    'owner of another vault': s.other.id,
    'platform admin (global role is not vault access)': s.admin.id,
  });
  const forEachNonOwner = async (s: Scene, fn: (label: string, id: string) => Promise<void>) => {
    for (const [label, id] of Object.entries(nonOwners(s))) await fn(label, id);
  };

  describe('blocks', () => {
    it('listing, reading, creating and deleting are owner-only; the answer for every non-owner is 403', async () => {
      const s = await scene();
      await forEachNonOwner(s, async (label, id) => {
        const got = [
          (await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, id)).status,
          (await ctx.request('GET', `/blocks/${s.block.id}`, undefined, id)).status,
          (await ctx.request('POST', '/blocks', { vault_id: s.vault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, id)).status,
          (await ctx.request('DELETE', `/blocks/${s.block.id}`, undefined, id)).status,
        ];
        expect([label, ...got]).toEqual([label, 403, 403, 403, 403]);
      });
      // ничего не создано и не удалено
      expect(await ctx.db.block.count({ where: { vaultId: s.vault.id } })).toBe(1);
      expect((await ctx.db.block.findUniqueOrThrow({ where: { id: s.block.id } })).deletedAt).toBeNull();
    });

    it('anonymous callers get 401 everywhere', async () => {
      const s = await scene();
      for (const [method, path] of [['GET', `/blocks?vault_id=${s.vault.id}`], ['GET', `/blocks/${s.block.id}`], ['POST', '/blocks'], ['DELETE', `/blocks/${s.block.id}`], ['GET', `/blocks/${s.block.id}/recipients`], ['POST', `/blocks/${s.block.id}/recipients`]]) {
        expect([method, path, (await ctx.request(method, path)).status]).toEqual([method, path, 401]);
      }
    });

    it('the owner works with the block, a deleted block is gone, and file/url blocks are refused', async () => {
      const s = await scene();
      expect((await ctx.request('GET', `/blocks/${s.block.id}`, undefined, s.owner.id)).status).toBe(200);
      const created = await ctx.request('POST', '/blocks', { vault_id: s.vault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, s.owner.id);
      expect(created.status).toBe(201);
      expect((await ctx.request('POST', '/blocks', { vault_id: s.vault.id, type: 'file', dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, s.owner.id)).status).toBe(400);
      expect((await ctx.request('DELETE', `/blocks/${created.body.id}`, undefined, s.owner.id)).status).toBe(200);
      expect((await ctx.request('GET', `/blocks/${created.body.id}`, undefined, s.owner.id)).status).toBe(404);
      expect((await ctx.request('DELETE', `/blocks/${created.body.id}`, undefined, s.owner.id)).status).toBe(404);
      const listed = await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(listed.body.map((b: any) => b.id)).toEqual([s.block.id]);
    });

    it('a block id of another vault is unusable even with a vault id of my own', async () => {
      const s = await scene();
      expect((await ctx.request('GET', `/blocks/${s.otherBlock.id}`, undefined, s.owner.id)).status).toBe(403);
      expect((await ctx.request('DELETE', `/blocks/${s.otherBlock.id}`, undefined, s.owner.id)).status).toBe(403);
      expect((await ctx.request('POST', '/blocks', { vault_id: s.otherVault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, s.owner.id)).status).toBe(403);
      const mine = await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(mine.body.map((b: any) => b.id)).not.toContain(s.otherBlock.id);
    });

    it('recipients of a block: reading and assigning are owner-only; a recipient of another vault is never assignable', async () => {
      const s = await scene();
      const foreignRecipient = (await ctx.request('POST', '/recipients', { vault_id: s.otherVault.id, contact: 'person@test.local' }, s.other.id)).body;
      const wrap = { recipient_id: foreignRecipient.id, dek_wrapped_for_recipient: SAMPLE.rsaWrap, key_fingerprint: 'a'.repeat(64) };
      await forEachNonOwner(s, async (label, id) => {
        expect([label, (await ctx.request('GET', `/blocks/${s.block.id}/recipients`, undefined, id)).status]).toEqual([label, 403]);
        expect([label, (await ctx.request('POST', `/blocks/${s.block.id}/recipients`, wrap, id)).status]).toEqual([label, 403]);
      });
      // владелец: чужой получатель — как несуществующий, без подсказки о его существовании
      expect((await ctx.request('POST', `/blocks/${s.block.id}/recipients`, wrap, s.owner.id)).status).toBe(404);
      expect((await ctx.request('POST', `/blocks/${s.block.id}/recipients`, { ...wrap, recipient_id: UUID }, s.owner.id)).status).toBe(404);
      expect((await ctx.request('GET', `/blocks/${s.block.id}/recipients`, undefined, s.owner.id)).body).toEqual([]);
      expect(await ctx.db.blockRecipient.count()).toBe(0);
    });
  });

  describe('public links', () => {
    it('managing the link of a block is owner-only for every non-owner; a deleted block has no link', async () => {
      const s = await scene();
      await forEachNonOwner(s, async (label, id) => {
        const got = [
          (await ctx.request('GET', `/blocks/${s.block.id}/public`, undefined, id)).status,
          (await ctx.request('PUT', `/blocks/${s.block.id}/public`, { enabled: true }, id)).status,
          (await ctx.request('DELETE', `/blocks/${s.block.id}/public`, undefined, id)).status,
        ];
        expect([label, ...got]).toEqual([label, 403, 403, 403]);
      });
      expect(await ctx.db.publicLink.count()).toBe(0);
      expect((await ctx.db.block.findUniqueOrThrow({ where: { id: s.block.id } })).isPublic).toBe(false);

      await ctx.request('DELETE', `/blocks/${s.block.id}`, undefined, s.owner.id);
      for (const method of ['GET', 'PUT', 'DELETE']) {
        const res = await ctx.request(method, `/blocks/${s.block.id}/public`, method === 'PUT' ? { enabled: true } : undefined, s.owner.id);
        expect([method, res.status]).toEqual([method, 404]);
      }
    });

    it('anonymous callers cannot manage links, and /p/:token stays closed to them until public messages are decided (#171)', async () => {
      const s = await scene();
      const put = await ctx.request('PUT', `/blocks/${s.block.id}/public`, { enabled: true }, s.owner.id);
      expect(put.status).toBe(200);
      const token = String(put.body.url).split('/p/')[1];
      for (const [method, path] of [['GET', `/blocks/${s.block.id}/public`], ['PUT', `/blocks/${s.block.id}/public`], ['DELETE', `/blocks/${s.block.id}/public`], ['GET', `/p/${token}`], ['GET', '/p/unknown-token']]) {
        expect([method, path, (await ctx.request(method, path)).status]).toEqual([method, path, 401]);
      }
      // и с входом ответ — только безопасные метаданные, без ключей и содержимого
      const open = await ctx.request('GET', `/p/${token}`, undefined, s.outsider.id);
      expect(open.status).toBe(200);
      expect(Object.keys(open.body).sort()).toEqual(['block_id', 'tags', 'type', 'updated_at']);
      expect(JSON.stringify(open.body)).not.toMatch(/dek|ciphertext|wrapped/i);
      expect(put.body).not.toHaveProperty('token_hash');
      expect(put.body).not.toHaveProperty('tokenHash');
    });
  });

  describe('heartbeat', () => {
    it('reading, changing and pinging the heartbeat of a vault is owner-only', async () => {
      const s = await scene();
      await forEachNonOwner(s, async (label, id) => {
        const got = [
          (await ctx.request('GET', `/vaults/${s.vault.id}/heartbeat`, undefined, id)).status,
          (await ctx.request('PATCH', `/vaults/${s.vault.id}/heartbeat`, { timeout_days: 3650 }, id)).status,
          (await ctx.request('POST', '/heartbeats/ping', { vault_id: s.vault.id }, id)).status,
        ];
        expect([label, ...got]).toEqual([label, 403, 403, 403]);
      });
      expect(await ctx.db.heartbeat.count()).toBe(0);
      expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).heartbeatTimeoutDays).toBe(s.vault.heartbeatTimeoutDays);
      for (const [method, path] of [['GET', `/vaults/${s.vault.id}/heartbeat`], ['PATCH', `/vaults/${s.vault.id}/heartbeat`], ['POST', '/heartbeats/ping']]) {
        expect([method, path, (await ctx.request(method, path)).status]).toEqual([method, path, 401]);
      }
      expect((await ctx.request('POST', '/heartbeats/ping', { vault_id: s.vault.id }, s.owner.id)).status).toBe(201);
    });
  });

  describe('vaults', () => {
    it('another user\'s vault is invisible: not listed, not readable (404), settings are not writable', async () => {
      const s = await scene();
      await forEachNonOwner(s, async (label, id) => {
        const list = await ctx.request('GET', '/vaults', undefined, id);
        expect(list.status).toBe(200);
        expect([label, list.body.map((v: any) => v.id).includes(s.vault.id)]).toEqual([label, false]);
        expect([label, (await ctx.request('GET', `/vaults/${s.vault.id}`, undefined, id)).status]).toEqual([label, 404]);
        expect([label, (await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { quorum_threshold: 3 }, id)).status]).toEqual([label, 404]);
      });
      expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).quorumThreshold).toBe(s.vault.quorumThreshold);
      for (const [method, path] of [['GET', '/vaults'], ['GET', `/vaults/${s.vault.id}`], ['PATCH', `/vaults/${s.vault.id}/settings`], ['POST', '/vaults']]) {
        expect([method, path, (await ctx.request(method, path)).status]).toEqual([method, path, 401]);
      }
    });

    it('primary_verifier_id must be an active verifier of this very vault', async () => {
      const s = await scene();
      const foreignVerifier = await ctx.factory.createVerifier(s.otherVault.id, { status: 'Active' });
      const bad = [s.invited.user.id, s.revoked.user.id, s.outsider.id, s.owner.id, s.admin.id, foreignVerifier.user.id, UUID];
      for (const id of bad) {
        const res = await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { primary_verifier_id: id }, s.owner.id);
        expect([id, res.status]).toEqual([id, 400]);
      }
      expect(await ctx.db.vaultUserRole.count({ where: { vaultId: s.vault.id, isPrimary: true } })).toBe(0);
      const ok = await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { primary_verifier_id: s.active.user.id }, s.owner.id);
      expect(ok.status).toBe(200);
      expect(await ctx.db.vaultUserRole.count({ where: { vaultId: s.vault.id, isPrimary: true, userId: s.active.user.id } })).toBe(1);
    });

    it('settings cannot be changed while a disclosure event is in progress (D4), even by the owner', async () => {
      const s = await scene();
      await ctx.factory.createVerifier(s.vault.id, { status: 'Active' });
      const started = await ctx.request('POST', '/orchestration/start', { vault_id: s.vault.id }, s.owner.id);
      expect(started.status).toBe(201);
      expect((await ctx.request('PATCH', `/vaults/${s.vault.id}/settings`, { quorum_threshold: 3 }, s.owner.id)).status).toBe(409);
      expect((await ctx.request('PATCH', `/vaults/${s.vault.id}/heartbeat`, { timeout_days: 365 }, s.owner.id)).status).toBe(409);
    });
  });

  describe('recovery shares', () => {
    it('a share is key material: only the owner of its vault reads, changes or deletes it, and it cannot be moved to another vault', async () => {
      const s = await scene();
      const created = await ctx.request('POST', '/recovery-shares', { vaultId: s.vault.id, shareIndex: 1, shareCipher: 'c' }, s.owner.id);
      expect(created.status).toBe(201);
      const id = created.body.id as string;
      await forEachNonOwner(s, async (label, userId) => {
        const got = [
          (await ctx.request('GET', `/recovery-shares?vault_id=${s.vault.id}`, undefined, userId)).status,
          (await ctx.request('GET', `/recovery-shares/${id}`, undefined, userId)).status,
          (await ctx.request('POST', '/recovery-shares', { vaultId: s.vault.id, shareIndex: 2, shareCipher: 'x' }, userId)).status,
          (await ctx.request('PATCH', `/recovery-shares/${id}`, { shareCipher: 'tampered' }, userId)).status,
          (await ctx.request('DELETE', `/recovery-shares/${id}`, undefined, userId)).status,
        ];
        expect([label, ...got]).toEqual([label, 403, 403, 403, 403, 403]);
      });
      const row = await ctx.db.recoveryShare.findUniqueOrThrow({ where: { id } });
      expect(row.shareCipher).toBe('c');
      expect(await ctx.db.recoveryShare.count()).toBe(1);
      // перенос доли в чужой сейф этим маршрутом не допускается даже владельцу
      expect((await ctx.request('PATCH', `/recovery-shares/${id}`, { vaultId: s.otherVault.id }, s.owner.id)).status).toBe(403);
      expect((await ctx.db.recoveryShare.findUniqueOrThrow({ where: { id } })).vaultId).toBe(s.vault.id);
      for (const [method, path] of [['GET', `/recovery-shares?vault_id=${s.vault.id}`], ['GET', `/recovery-shares/${id}`], ['POST', '/recovery-shares'], ['PATCH', `/recovery-shares/${id}`], ['DELETE', `/recovery-shares/${id}`]]) {
        expect([method, path, (await ctx.request(method, path)).status]).toEqual([method, path, 401]);
      }
    });
  });

  describe('malformed identifiers', () => {
    it('a malformed id is a 400 on every route that takes one, never a 500 from the database', async () => {
      const s = await scene();
      const bad = 'not-a-uuid';
      const calls: Array<[string, string, unknown?, string?]> = [
        ['GET', `/plans/${bad}`, undefined, s.outsider.id],
        ['GET', `/subscriptions/${bad}`, undefined, s.admin.id],
        ['PATCH', `/subscriptions/${bad}`, {}, s.admin.id],
        ['DELETE', `/subscriptions/${bad}`, undefined, s.admin.id],
        ['PATCH', `/plans/${bad}`, {}, s.admin.id],
        ['DELETE', `/plans/${bad}`, undefined, s.admin.id],
        ['GET', `/users/${bad}`, undefined, s.admin.id],
        ['PATCH', `/users/${bad}`, {}, s.admin.id],
        ['DELETE', `/users/${bad}`, undefined, s.admin.id],
        ['GET', `/audit-logs/${bad}`, undefined, s.admin.id],
        ['GET', `/vaults/${bad}`, undefined, s.owner.id],
        ['PATCH', `/vaults/${bad}/settings`, {}, s.owner.id],
        ['GET', `/vaults/${bad}/heartbeat`, undefined, s.owner.id],
        ['PATCH', `/vaults/${bad}/heartbeat`, {}, s.owner.id],
        ['GET', `/blocks/${bad}`, undefined, s.owner.id],
        ['DELETE', `/blocks/${bad}`, undefined, s.owner.id],
        ['GET', `/blocks/${bad}/recipients`, undefined, s.owner.id],
        ['GET', `/blocks/${bad}/public`, undefined, s.owner.id],
        ['GET', `/recovery-shares/${bad}`, undefined, s.owner.id],
        ['DELETE', `/recovery-shares/${bad}`, undefined, s.owner.id],
        ['POST', `/recipients/${bad}/confirm-key`, { key_fingerprint: 'a'.repeat(64) }, s.owner.id],
        ['GET', `/verification-events/${bad}`, undefined, s.owner.id],
      ];
      for (const [method, path, body, userId] of calls) {
        const res = await ctx.request(method, path, body, userId);
        expect([method, path, res.status]).toEqual([method, path, 400]);
      }
    });
  });

  describe('missing objects', () => {
    it('reading, changing or deleting an object that does not exist is a 404 (never an empty 200 or a 500)', async () => {
      const s = await scene();
      const calls: Array<[string, string, unknown?]> = [
        ['GET', `/plans/${UUID}`],
        ['PATCH', `/plans/${UUID}`, {}],
        ['DELETE', `/plans/${UUID}`],
        ['GET', `/subscriptions/${UUID}`],
        ['PATCH', `/subscriptions/${UUID}`, {}],
        ['DELETE', `/subscriptions/${UUID}`],
        ['GET', `/users/${UUID}`],
        ['PATCH', `/users/${UUID}`, {}],
        ['DELETE', `/users/${UUID}`],
        ['GET', `/audit-logs/${UUID}`],
      ];
      for (const [method, path, body] of calls) {
        const res = await ctx.request(method, path, body, s.admin.id);
        expect([method, path, res.status]).toEqual([method, path, 404]);
        expect(res.body).toEqual(expect.objectContaining({ statusCode: 404 }));
        expect(JSON.stringify(res.body)).not.toMatch(/prisma|invocation|table|findUnique/i);
      }
    });

    it('a uniqueness conflict is a 409 without database details', async () => {
      const s = await scene();
      const res = await ctx.request('POST', '/users', { email: 'owner@test.local' }, s.admin.id);
      expect(res.status).toBe(409);
      expect(JSON.stringify(res.body)).not.toMatch(/prisma|constraint|user_email_key/i);
    });
  });

  describe('platform routes: admin vs signed-in user vs anonymous', () => {
    const plan = { tier: 'Free', limits: {} };
    /** Маршрут × роль → ожидаемый код. Администраторские маршруты закрыты для обычного пользователя независимо от владения сейфом. */
    const adminRoutes: Array<[string, string, unknown?]> = [
      ['GET', '/audit-logs'],
      ['GET', `/audit-logs/${UUID}`],
      ['GET', '/subscriptions'],
      ['GET', `/subscriptions/${UUID}`],
      ['POST', '/subscriptions', {}],
      ['PATCH', `/subscriptions/${UUID}`, {}],
      ['DELETE', `/subscriptions/${UUID}`],
      ['POST', '/plans', plan],
      ['PATCH', `/plans/${UUID}`, {}],
      ['DELETE', `/plans/${UUID}`],
      ['GET', '/users'],
      ['GET', `/users/${UUID}`],
      ['POST', '/users', { email: 'forged@test.local' }],
      ['PATCH', `/users/${UUID}`, {}],
      ['DELETE', `/users/${UUID}`],
    ];

    it('anonymous: 401; ordinary user (even a vault owner, a verifier or an admin of a vault): 403; platform admin passes the role check', async () => {
      const s = await scene();
      const vaultAdmin = await ctx.factory.createUser({ email: 'vault-admin@test.local' });
      await ctx.db.vaultUserRole.create({ data: { vaultId: s.vault.id, userId: vaultAdmin.id, role: 'Admin', status: 'Active', isPrimary: false } });
      const ordinary = { owner: s.owner.id, verifier: s.active.user.id, outsider: s.outsider.id, 'admin of a vault': vaultAdmin.id };
      for (const [method, path, body] of adminRoutes) {
        expect([method, path, (await ctx.request(method, path, body)).status]).toEqual([method, path, 401]);
        for (const [label, id] of Object.entries(ordinary)) {
          expect([label, method, path, (await ctx.request(method, path, body, id)).status]).toEqual([label, method, path, 403]);
        }
        const asAdmin = (await ctx.request(method, path, body, s.admin.id)).status;
        // роль проверена; дальше — обычная валидация/поиск объекта, но не 401/403
        expect([method, path, [401, 403].includes(asAdmin)]).toEqual([method, path, false]);
      }
    });

    it('plans are readable by any signed-in user, but not anonymously; writes need the admin role', async () => {
      const s = await scene();
      expect((await ctx.request('GET', '/plans')).status).toBe(401);
      expect((await ctx.request('GET', '/plans', undefined, s.outsider.id)).status).toBe(200);
      expect((await ctx.request('GET', '/plans', undefined, s.admin.id)).status).toBe(200);
    });

    it('a platform admin does not get vault content through their global role', async () => {
      const s = await scene();
      expect((await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, s.admin.id)).status).toBe(403);
      expect((await ctx.request('GET', `/vaults/${s.vault.id}`, undefined, s.admin.id)).status).toBe(404);
      expect((await ctx.request('GET', `/recovery-shares?vault_id=${s.vault.id}`, undefined, s.admin.id)).status).toBe(403);
    });
  });
});
