import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { randomUUID } from 'crypto';
import { blockBody, bootstrapApp, closeApp, Ctx, SAMPLE } from './helper.js';

/**
 * Хранение клиентского шифрования (ADR-0003, #152): сервер не создаёт ключ сейфа, принимает его от браузера один раз,
 * хранит шифротекст как непрозрачную строку и проверяет только форму. Настоящее приложение, guard'ы, PostgreSQL.
 */
describe('vault key and block ciphertext (real PostgreSQL)', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  async function scene() {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { mkWrapped: null });
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const verifier = await ctx.factory.createVerifier(vault.id, { status: 'Active' });
    const admin = await ctx.factory.createUser({ email: 'admin@test.local', role: 'Admin' });
    return { owner, vault, outsider, verifier, admin };
  }
  const keyOf = async (vaultId: string) => (await ctx.db.vault.findUniqueOrThrow({ where: { id: vaultId } })).mkWrapped;
  const newBlock = (vaultId: string, userId: string, over: Record<string, unknown> = {}) =>
    ctx.request('POST', '/blocks', blockBody(vaultId, over), userId);

  describe('the vault key', () => {
    it('the server does not generate a key for a new vault', async () => {
      const owner = await ctx.factory.createUser();
      const created = await ctx.request('POST', '/vaults', { name: 'Новый' }, owner.id);
      expect(created.status).toBe(201);
      expect(created.body.mkWrapped).toBeNull();
      expect(await keyOf(created.body.id)).toBeNull();
    });

    it('only the owner sets it, once; everybody else is refused with 403 and the key stays empty', async () => {
      const s = await scene();
      const put = (id?: string, body: unknown = { mk_wrapped: SAMPLE.keyEnvelope }) => ctx.request('PUT', `/vaults/${s.vault.id}/key`, body, id);
      expect((await put()).status).toBe(401);
      for (const [label, id] of [['outsider', s.outsider.id], ['active verifier', s.verifier.user.id], ['platform admin', s.admin.id]] as const) {
        expect([label, (await put(id)).status]).toEqual([label, 403]);
      }
      expect(await keyOf(s.vault.id)).toBeNull();

      const ok = await put(s.owner.id);
      expect(ok.status).toBe(200);
      // явный ответ: идентификатор и то, что сохранено, без остальных полей сейфа
      expect(ok.body).toEqual({ id: s.vault.id, mk_wrapped: SAMPLE.keyEnvelope });
      expect(await keyOf(s.vault.id)).toBe(SAMPLE.keyEnvelope);

      // повторная настройка не заменяет ключ: иначе блоки под прежним ключом стали бы нечитаемыми
      const other = `v1.${'D'.repeat(16)}.${'E'.repeat(64)}`;
      expect((await put(s.owner.id, { mk_wrapped: other })).status).toBe(409);
      expect(await keyOf(s.vault.id)).toBe(SAMPLE.keyEnvelope);
    });

    it('two simultaneous requests: exactly one wins', async () => {
      const s = await scene();
      const a = `v1.${'A'.repeat(16)}.${'1'.repeat(64)}`;
      const b = `v1.${'A'.repeat(16)}.${'2'.repeat(64)}`;
      const statuses = (await Promise.all([a, b].map((k) => ctx.request('PUT', `/vaults/${s.vault.id}/key`, { mk_wrapped: k }, s.owner.id)))).map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409]);
      expect([a, b]).toContain(await keyOf(s.vault.id));
    });

    it('anything but a v1 envelope of a 256-bit key is refused', async () => {
      const s = await scene();
      const bad: unknown[] = [
        undefined, null, 42, '', 'mk', 'ZGVr', Buffer.alloc(32).toString('base64'),
        `v2.${'A'.repeat(16)}.${'B'.repeat(64)}`,
        `v1.${'A'.repeat(16)}.${'B'.repeat(63)}`,
        `v1.${'A'.repeat(16)}.${'B'.repeat(65)}`,
        SAMPLE.ciphertext, // шифротекст блока — не упакованный ключ
      ];
      for (const mk_wrapped of bad) {
        expect([String(mk_wrapped), (await ctx.request('PUT', `/vaults/${s.vault.id}/key`, { mk_wrapped }, s.owner.id)).status]).toEqual([String(mk_wrapped), 400]);
      }
      expect((await ctx.request('PUT', `/vaults/not-a-uuid/key`, { mk_wrapped: SAMPLE.keyEnvelope }, s.owner.id)).status).toBe(400);
      // идентификатор сейфа входит в соль HKDF и AAD: «тот же» UUID в верхнем регистре не принимается,
      // иначе ключ нельзя было бы развернуть с идентификатором, который вернёт сервер
      const upper = await ctx.request('PUT', `/vaults/${s.vault.id.toUpperCase()}/key`, { mk_wrapped: SAMPLE.keyEnvelope }, s.owner.id);
      expect(upper.status).toBe(400);
      expect(await keyOf(s.vault.id)).toBeNull();
    });
  });

  describe('block ciphertext', () => {
    it('a block cannot be created until the vault key is set up', async () => {
      const s = await scene();
      const res = await newBlock(s.vault.id, s.owner.id);
      expect(res.status).toBe(409);
      expect(await ctx.db.block.count()).toBe(0);
      await ctx.request('PUT', `/vaults/${s.vault.id}/key`, { mk_wrapped: SAMPLE.keyEnvelope }, s.owner.id);
      expect((await newBlock(s.vault.id, s.owner.id)).status).toBe(201);
    });

    it('stores the ciphertext as is; the answer is an explicit snake_case DTO with the real size', async () => {
      const s = await scene();
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { mkWrapped: SAMPLE.keyEnvelope } });
      const ciphertext = `v1.${'Q'.repeat(16)}.${'z'.repeat(4000)}`;
      const created = await newBlock(s.vault.id, s.owner.id, { ciphertext, tags: ['паспорт'], checksum: 'sum' });
      expect(created.status).toBe(201);
      expect(Object.keys(created.body).sort()).toEqual([
        'checksum', 'ciphertext', 'created_at', 'dek_wrapped', 'id', 'is_public', 'metadata', 'size', 'tags', 'type', 'updated_at', 'vault_id',
      ]);
      expect(created.body).toMatchObject({ vault_id: s.vault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope, ciphertext, size: ciphertext.length, tags: ['паспорт'] });
      expect((await ctx.db.block.findUniqueOrThrow({ where: { id: created.body.id } })).ciphertext).toBe(ciphertext);

      const got = await ctx.request('GET', `/blocks/${created.body.id}`, undefined, s.owner.id);
      expect(got.status).toBe(200);
      expect(got.body).toEqual(created.body);

      // в списке шифротекста нет вообще: до 200 блоков по десятки килобайт — лишний трафик
      const listed = await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(listed.status).toBe(200);
      expect(listed.body).toHaveLength(1);
      expect(listed.body[0]).not.toHaveProperty('ciphertext');
      expect(listed.body[0]).toMatchObject({ id: created.body.id, size: ciphertext.length, dek_wrapped: SAMPLE.keyEnvelope });
      expect(JSON.stringify(listed.body)).not.toContain('zzzz');
    });

    it('the block id is chosen by the client: the ciphertext and the wrapped key are bound to it', async () => {
      const s = await scene();
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { mkWrapped: SAMPLE.keyEnvelope } });
      const id = randomUUID();
      const created = await newBlock(s.vault.id, s.owner.id, { id });
      expect(created.status).toBe(201);
      expect(created.body.id).toBe(id);
      expect((await ctx.request('GET', `/blocks/${id}`, undefined, s.owner.id)).body.ciphertext).toBe(SAMPLE.ciphertext);

      // занятый идентификатор — 409 и в том же, и в чужом сейфе; блок не перезаписывается
      const other = await ctx.factory.createUser({ email: 'other-owner@test.local' });
      const otherVault = await ctx.factory.createVault(other.id);
      expect((await newBlock(s.vault.id, s.owner.id, { id, ciphertext: `v1.${'A'.repeat(16)}.${'F'.repeat(40)}` })).status).toBe(409);
      expect((await newBlock(otherVault.id, other.id, { id })).status).toBe(409);
      expect((await ctx.db.block.findUniqueOrThrow({ where: { id } })).ciphertext).toBe(SAMPLE.ciphertext);
      expect(await ctx.db.block.count()).toBe(1);

      // без идентификатора, с чужим форматом и не в каноническом (строчном) виде — 400: клиент и сервер должны
      // писать идентификаторы в контексте шифрования одинаково, а PostgreSQL вернёт строчные
      for (const bad of [undefined, null, '', 'block-1', 42, randomUUID().toUpperCase()]) {
        expect([String(bad), (await newBlock(s.vault.id, s.owner.id, { id: bad })).status]).toEqual([String(bad), 400]);
      }
      expect(await ctx.db.block.count()).toBe(1);
      expect((await ctx.request('POST', '/blocks', blockBody(s.vault.id.toUpperCase()), s.owner.id)).status).toBe(400);
      expect(await ctx.db.block.count()).toBe(1);
    });

    it('refuses what is not a v1 envelope, a missing ciphertext, and an oversized one', async () => {
      const s = await scene();
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { mkWrapped: SAMPLE.keyEnvelope } });
      const cases: Array<[string, Record<string, unknown>]> = [
        ['plain text instead of a ciphertext', { ciphertext: 'Пароль от банка: 1234' }],
        ['base64 instead of an envelope', { ciphertext: Buffer.from('secret').toString('base64') }],
        ['too short ciphertext', { ciphertext: `v1.${'A'.repeat(16)}.${'C'.repeat(10)}` }],
        ['unknown version', { ciphertext: `v2.${'A'.repeat(16)}.${'C'.repeat(40)}` }],
        ['oversized ciphertext', { ciphertext: `v1.${'A'.repeat(16)}.${'C'.repeat(60_000)}` }],
        ['ciphertext is a number', { ciphertext: 7 }],
        ['dek is not an envelope', { dek_wrapped: 'dek' }],
        ['dek of a wrong size', { dek_wrapped: SAMPLE.ciphertext }],
      ];
      for (const [label, over] of cases) expect([label, (await newBlock(s.vault.id, s.owner.id, over)).status]).toEqual([label, 400]);
      const missing = await ctx.request('POST', '/blocks', { id: randomUUID(), vault_id: s.vault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope }, s.owner.id);
      expect(missing.status).toBe(400);
      expect(await ctx.db.block.count()).toBe(0);
    });

    it('non-owners cannot read or create blocks in the vault (404/403 as before) and see no ciphertext', async () => {
      const s = await scene();
      await ctx.db.vault.update({ where: { id: s.vault.id }, data: { mkWrapped: SAMPLE.keyEnvelope } });
      const created = await newBlock(s.vault.id, s.owner.id);
      for (const id of [s.outsider.id, s.verifier.user.id, s.admin.id]) {
        const get = await ctx.request('GET', `/blocks/${created.body.id}`, undefined, id);
        const list = await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, id);
        const post = await newBlock(s.vault.id, id);
        expect([get.status, list.status, post.status]).toEqual([403, 403, 403]);
        expect(JSON.stringify([get.body, list.body, post.body])).not.toContain(SAMPLE.ciphertext);
      }
    });

    it('legacy blocks without ciphertext are shown with nulls instead of failing', async () => {
      const s = await scene();
      const legacy = await ctx.db.block.create({ data: { vaultId: s.vault.id, type: 'text', dekWrapped: 'dek', tags: [] } });
      const got = await ctx.request('GET', `/blocks/${legacy.id}`, undefined, s.owner.id);
      expect(got.status).toBe(200);
      expect(got.body).toMatchObject({ id: legacy.id, ciphertext: null, size: null });
      const listed = await ctx.request('GET', `/blocks?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(listed.body[0]).toMatchObject({ id: legacy.id, size: null });
    });
  });

  describe('wrapping under the key of a recipient', () => {
    it('only an RSA-OAEP 3072 ciphertext (384 bytes of canonical base64) is accepted', async () => {
      const s = await scene();
      const block = await ctx.db.block.create({ data: { vaultId: s.vault.id, type: 'text', dekWrapped: SAMPLE.keyEnvelope, tags: [] } });
      const recipient = (await ctx.request('POST', '/recipients', { vault_id: s.vault.id, contact: 'person@test.local' }, s.owner.id)).body;
      const attempt = (wrap: unknown) =>
        ctx.request('POST', `/blocks/${block.id}/recipients`, { recipient_id: recipient.id, dek_wrapped_for_recipient: wrap, key_fingerprint: 'a'.repeat(64) }, s.owner.id);
      const ok = Buffer.alloc(384, 5).toString('base64');
      const bad: unknown[] = [
        'd3JhcHBlZA==', 'wrapped', '', SAMPLE.keyEnvelope,
        Buffer.alloc(32).toString('base64'), Buffer.alloc(383).toString('base64'), Buffer.alloc(385).toString('base64'),
        ok.slice(0, -2), `${ok}A`, `${ok} ${ok}`, Buffer.alloc(384, 0xfb).toString('base64').replace(/\+/g, '-').replace(/\//g, '_'), 384,
      ];
      for (const wrap of bad) expect([String(wrap).slice(0, 20), (await attempt(wrap)).status]).toEqual([String(wrap).slice(0, 20), 400]);
      // правильная форма доходит до проверки ключа получателя: ключ не заявлен, назначение отклоняется по существу
      expect((await attempt(ok)).status).toBe(409);
      // внешние пробелы обрезаются, как и раньше: форма после обрезки та же
      expect((await attempt(`${ok}\n`)).status).toBe(409);
      expect(await ctx.db.blockRecipient.count()).toBe(0);
    });
  });
});
