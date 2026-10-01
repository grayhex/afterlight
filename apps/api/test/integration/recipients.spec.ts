import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createHash } from 'crypto';
import { bootstrapApp, closeApp, Ctx, SAMPLE } from './helper.js';

const fp = (key: string) => createHash('sha256').update(key.trim(), 'utf8').digest('hex');

/** Получатели в контексте сейфа и путь ключа: заявлен получателем → подтверждён владельцем → под него упаковывается DEK. */
describe('recipients are scoped to a vault and their key must be confirmed (real PostgreSQL)', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  async function scene() {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    const vault = await ctx.factory.createVault(owner.id);
    const block = await ctx.db.block.create({ data: { vaultId: vault.id, type: 'text', dekWrapped: 'dek', tags: [] } });
    const other = await ctx.factory.createUser({ email: 'other-owner@test.local' });
    const otherVault = await ctx.factory.createVault(other.id);
    const otherBlock = await ctx.db.block.create({ data: { vaultId: otherVault.id, type: 'text', dekWrapped: 'dek', tags: [] } });
    const person = await ctx.factory.createUser({ email: 'person@test.local' }); // будущий получатель, подтверждённый аккаунт
    return { owner, vault, block, other, otherVault, otherBlock, person };
  }
  const designate = (s: Awaited<ReturnType<typeof scene>>, who = s.owner, vault = s.vault) =>
    ctx.request('POST', '/recipients', { vault_id: vault.id, contact: 'Person@Test.Local' }, who.id);
  const claim = (userId: string, pubkey: string) => ctx.request('PUT', '/recipients/me/key', { pubkey }, userId);
  const confirm = (s: Awaited<ReturnType<typeof scene>>, recipientId: string, fingerprint: string, who = s.owner) =>
    ctx.request('POST', `/recipients/${recipientId}/confirm-key`, { key_fingerprint: fingerprint }, who.id);
  const assign = (s: Awaited<ReturnType<typeof scene>>, recipientId: string, fingerprint: string, who = s.owner, blockId = s.block.id) =>
    ctx.request('POST', `/blocks/${blockId}/recipients`, { recipient_id: recipientId, dek_wrapped_for_recipient: SAMPLE.rsaWrap, key_fingerprint: fingerprint }, who.id);

  describe('ownership by vault', () => {
    it('the same address is a separate recipient in every vault; the address is normalized', async () => {
      const s = await scene();
      const a = await designate(s);
      const again = await designate(s);
      const b = await designate(s, s.other, s.otherVault);
      expect([a.status, again.status, b.status]).toEqual([201, 201, 201]);
      expect(again.body.id).toBe(a.body.id);
      expect(b.body.id).not.toBe(a.body.id);
      expect(a.body).toMatchObject({ contact: 'person@test.local', vault_id: s.vault.id, key_status: 'Invited' });
      expect(await ctx.db.recipient.count()).toBe(2);
    });

    it('a recipient of another vault can be neither read, confirmed nor assigned to my block', async () => {
      const s = await scene();
      const mine = (await designate(s)).body;
      const theirs = (await designate(s, s.other, s.otherVault)).body;
      await claim(s.person.id, 'KEY-P');
      const f = fp('KEY-P');

      const list = await ctx.request('GET', `/recipients?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(list.body.map((r: any) => r.id)).toEqual([mine.id]);
      expect((await ctx.request('GET', `/recipients?vault_id=${s.otherVault.id}`, undefined, s.owner.id)).status).toBe(403);

      expect((await confirm(s, theirs.id, f)).status).toBe(403); // чужой получатель
      expect((await confirm(s, '11111111-1111-4111-8111-111111111111', f)).status).toBe(403); // несуществующий неотличим
      expect((await ctx.db.recipient.findUniqueOrThrow({ where: { id: theirs.id } })).verificationStatus).toBe('KeyClaimed');

      expect((await confirm(s, mine.id, f)).status).toBe(201);
      expect((await confirm(s, theirs.id, f, s.other)).status).toBe(201);
      // получатель чужого сейфа не назначается на мой блок, даже с подтверждённым ключом
      expect((await assign(s, theirs.id, f)).status).toBe(404);
      expect(await ctx.db.blockRecipient.count()).toBe(0);
      expect((await assign(s, mine.id, f, s.other, s.otherBlock.id)).status).toBe(404);
      expect((await assign(s, mine.id, f, s.owner, s.otherBlock.id)).status).toBe(403); // и в чужой блок нельзя
    });

    it('an owner supplied key is ignored and a verifier cannot confirm', async () => {
      const s = await scene();
      const res = await ctx.request('POST', '/recipients', { vault_id: s.vault.id, contact: 'person@test.local', pubkey: 'KEY-OWNER' }, s.owner.id);
      expect(res.body).toMatchObject({ public_key: null, key_status: 'Invited' });
      const v = await ctx.factory.createVerifier(s.vault.id);
      await claim(s.person.id, 'KEY-P');
      expect((await confirm(s, res.body.id, fp('KEY-P'), { id: v.user.id } as any)).status).toBe(403);
    });
  });

  describe('key claim', () => {
    it('only the account with the verified address of the recipient can claim the key; it applies to all its vaults', async () => {
      const s = await scene();
      const mine = (await designate(s)).body;
      const theirs = (await designate(s, s.other, s.otherVault)).body;
      const stranger = await ctx.factory.createUser({ email: 'stranger@test.local' });
      const unverified = await ctx.db.user.create({ data: { email: 'person2@test.local' } });
      await ctx.request('POST', '/recipients', { vault_id: s.vault.id, contact: 'person2@test.local' }, s.owner.id);

      // посторонний аккаунт ничего не заявляет: у него нет назначений
      expect((await claim(stranger.id, 'KEY-EVIL')).body).toMatchObject({ recipients: 0 });
      expect((await ctx.db.recipient.findUniqueOrThrow({ where: { id: mine.id } })).pubkey).toBeNull();
      // адрес не подтверждён — нельзя
      expect((await claim(unverified.id, 'KEY-X')).status).toBe(403);
      // без входа — нельзя
      expect((await ctx.request('PUT', '/recipients/me/key', { pubkey: 'K' })).status).toBe(401);

      const ok = await claim(s.person.id, '  KEY-P  ');
      expect(ok.status).toBe(200);
      expect(ok.body).toEqual({ key_fingerprint: fp('KEY-P'), recipients: 2 });
      for (const id of [mine.id, theirs.id]) {
        expect(await ctx.db.recipient.findUniqueOrThrow({ where: { id } })).toMatchObject({ pubkey: 'KEY-P', keyFingerprint: fp('KEY-P'), verificationStatus: 'KeyClaimed' });
      }
      // владелец видит отпечаток, чтобы сверить его вне сервера
      const list = await ctx.request('GET', `/recipients?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(list.body.find((r: any) => r.id === mine.id)).toMatchObject({ key_status: 'KeyClaimed', key_fingerprint: fp('KEY-P'), key_confirmed_at: null });
    });
  });

  describe('confirmation and wrapping', () => {
    it('confirmation needs the exact fingerprint of the claimed key; wrapping needs the confirmed one', async () => {
      const s = await scene();
      const r = (await designate(s)).body;
      // ключа ещё нет
      expect((await confirm(s, r.id, fp('KEY-P'))).status).toBe(409);
      expect((await assign(s, r.id, fp('KEY-P'))).status).toBe(409); // не подтверждён

      await claim(s.person.id, 'KEY-P');
      expect((await confirm(s, r.id, fp('OTHER'))).status).toBe(409); // не тот отпечаток
      expect((await confirm(s, r.id, 'zz')).status).toBe(400);
      expect((await assign(s, r.id, fp('KEY-P'))).status).toBe(409); // заявлен, но не подтверждён

      // запись отпечатка с двоеточиями и в верхнем регистре равна канонической
      const pretty = fp('KEY-P').toUpperCase().match(/.{2}/g)!.join(':');
      const ok = await confirm(s, r.id, pretty);
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ key_status: 'KeyConfirmed', key_fingerprint: fp('KEY-P') });
      expect(ok.body.key_confirmed_at).toEqual(expect.any(String));

      expect((await assign(s, r.id, fp('OTHER'))).status).toBe(409); // упаковка под другой ключ
      const done = await assign(s, r.id, fp('KEY-P'));
      expect(done.status).toBe(201);
      expect(done.body).toMatchObject({ contact: 'person@test.local', wrap_valid: true, wrapped_for_fingerprint: fp('KEY-P') });
      expect(JSON.stringify(done.body)).not.toContain(SAMPLE.rsaWrap);
      expect(JSON.stringify(done.body)).not.toMatch(/dek_wrapped/);
    });

    it('a key change drops the confirmation and invalidates earlier wrappings until the owner confirms again', async () => {
      const s = await scene();
      const r = (await designate(s)).body;
      await claim(s.person.id, 'KEY-1');
      await confirm(s, r.id, fp('KEY-1'));
      expect((await assign(s, r.id, fp('KEY-1'))).status).toBe(201);
      const listed = () => ctx.request('GET', `/blocks/${s.block.id}/recipients`, undefined, s.owner.id);
      expect((await listed()).body[0]).toMatchObject({ wrap_valid: true });

      // тот же ключ повторно: подтверждение остаётся
      await claim(s.person.id, 'KEY-1');
      expect((await ctx.db.recipient.findUniqueOrThrow({ where: { id: r.id } })).verificationStatus).toBe('KeyConfirmed');

      await claim(s.person.id, 'KEY-2');
      const after = await ctx.db.recipient.findUniqueOrThrow({ where: { id: r.id } });
      expect(after).toMatchObject({ verificationStatus: 'KeyClaimed', keyFingerprint: fp('KEY-2'), keyConfirmedAt: null, keyConfirmedFingerprint: null });
      expect((await listed()).body[0]).toMatchObject({ key_status: 'KeyClaimed', wrap_valid: false });

      // старый отпечаток больше не подтверждается и не годится для упаковки
      expect((await confirm(s, r.id, fp('KEY-1'))).status).toBe(409);
      expect((await assign(s, r.id, fp('KEY-1'))).status).toBe(409);
      expect((await assign(s, r.id, fp('KEY-2'))).status).toBe(409);

      await confirm(s, r.id, fp('KEY-2'));
      expect((await assign(s, r.id, fp('KEY-2'))).status).toBe(201);
      expect((await listed()).body[0]).toMatchObject({ wrap_valid: true, wrapped_for_fingerprint: fp('KEY-2') });
    });

    it('a confirmation racing a key change never confirms the old key', async () => {
      const s = await scene();
      const r = (await designate(s)).body;
      await claim(s.person.id, 'KEY-1');
      const results = await Promise.all([confirm(s, r.id, fp('KEY-1')), claim(s.person.id, 'KEY-2')]);
      expect(results[1].status).toBe(200);
      const row = await ctx.db.recipient.findUniqueOrThrow({ where: { id: r.id } });
      expect(row.keyFingerprint).toBe(fp('KEY-2'));
      // подтверждённый отпечаток либо отсутствует, либо равен текущему ключу — старый ключ подтверждённым остаться не может
      expect(row.keyConfirmedFingerprint === null || row.keyConfirmedFingerprint === row.keyFingerprint).toBe(true);
    });
  });

  describe('deferred paths are switched off explicitly', () => {
    it('only text blocks can be created: file and url are rejected', async () => {
      const s = await scene();
      for (const type of ['file', 'url', 'image']) {
        const res = await ctx.request('POST', '/blocks', { vault_id: s.vault.id, type, dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, s.owner.id);
        expect(res.status).toBe(400);
      }
      expect((await ctx.request('POST', '/blocks', { vault_id: s.vault.id, type: 'text', dek_wrapped: SAMPLE.keyEnvelope, ciphertext: SAMPLE.ciphertext }, s.owner.id)).status).toBe(201);
    });
  });
});
