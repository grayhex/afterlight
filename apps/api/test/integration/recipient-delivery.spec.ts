import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createHash } from 'crypto';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { blockBody, bootstrapApp, closeApp, Ctx, SAMPLE } from './helper.js';
import { rsaSpki } from '../support/rsa-spki.js';

/**
 * Выдача получателю (ADR-0003, поток 6; #152 часть 3): настоящее приложение, настоящий движок раскрытия (#150) с
 * управляемыми часами, PostgreSQL. Получатель получает шифротекст и свою упаковку ключа только после Finalized и только
 * по своему назначению; всем остальным и в любое другое время — ничего.
 */
const H = 3600 * 1000;
const fp = (key: string) => createHash('sha256').update(key.trim(), 'utf8').digest('hex');

describe('delivery to the recipient after the release (real engine, managed clock)', () => {
  let ctx: Ctx;
  let t0: Date;
  const at = (ms: number) => new Date(t0.getTime() + ms);
  const engine = () => ctx.moduleRef.get(OrchestratorService);

  beforeEach(async () => {
    ctx = await bootstrapApp();
    t0 = new Date();
    ctx.clock.setNow(t0);
  });
  afterEach(async () => { await closeApp(ctx); });

  const PERSON_KEY = rsaSpki('person');
  const CIPHER = `v1.${'A'.repeat(16)}.${'S'.repeat(60)}`;
  const WRAP = Buffer.alloc(384, 3).toString('base64');

  async function scene() {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2, graceHours: 24 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const person = await ctx.factory.createUser({ email: 'person@test.local' });
    const other = await ctx.factory.createUser({ email: 'other-person@test.local' }); // получатель в этом же сейфе, но без назначения блока
    const admin = await ctx.factory.createUser({ email: 'admin@test.local', role: 'Admin' });

    const block = (await ctx.request('POST', '/blocks', blockBody(vault.id, { ciphertext: CIPHER }), owner.id)).body;
    const designate = async (contact: string) => (await ctx.request('POST', '/recipients', { vault_id: vault.id, contact }, owner.id)).body;
    const recipient = await designate('person@test.local');
    const otherRecipient = await designate('other-person@test.local');
    return { owner, vault, v1, v2, outsider, person, other, admin, block, recipient, otherRecipient };
  }
  type S = Awaited<ReturnType<typeof scene>>;

  /** Получатель заявил ключ, владелец подтвердил отпечаток, владелец упаковал DEK под него. */
  async function arm(s: S, key = PERSON_KEY, blockId = s.block.id) {
    expect((await ctx.request('PUT', '/recipients/me/key', { pubkey: key }, s.person.id)).status).toBe(200);
    expect((await ctx.request('POST', `/recipients/${s.recipient.id}/confirm-key`, { key_fingerprint: fp(key) }, s.owner.id)).status).toBe(201);
    const assigned = await ctx.request('POST', `/blocks/${blockId}/recipients`, { recipient_id: s.recipient.id, dek_wrapped_for_recipient: WRAP, key_fingerprint: fp(key) }, s.owner.id);
    expect(assigned.status).toBe(201);
  }
  const start = (s: S) => ctx.request('POST', '/orchestration/start', { vault_id: s.vault.id }, s.owner.id);
  const vote = (s: S, who: string, decision: 'Confirm' | 'Deny') => ctx.request('POST', '/orchestration/decision', { vault_id: s.vault.id, decision }, who);
  const cancel = (s: S) => ctx.request('POST', '/orchestration/cancel', { vault_id: s.vault.id }, s.owner.id);
  const toGrace = async (s: S) => {
    expect((await start(s)).status).toBe(201);
    await vote(s, s.v1.user.id, 'Confirm');
    expect((await vote(s, s.v2.user.id, 'Confirm')).body.state).toBe('Grace');
  };
  const release = async (s: S) => {
    await toGrace(s);
    expect(await engine().processTimers(at(24 * H))).toEqual({ finalized: 1, rejected: 0 });
    expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).status).toBe('Released');
  };
  const list = (userId?: string) => ctx.request('GET', '/recipients/me/deliveries', undefined, userId);
  const get = (blockId: string, userId?: string) => ctx.request('GET', `/recipients/me/deliveries/${blockId}`, undefined, userId);

  it('delivers the ciphertext and the wrapped key only after the event is finalized — and not a moment before', async () => {
    const s = await scene();
    await arm(s);

    // назначение есть, но сейф не раскрыт
    expect((await list(s.person.id)).body).toEqual([]);
    expect((await get(s.block.id, s.person.id)).status).toBe(404);

    await toGrace(s);
    expect((await list(s.person.id)).body).toEqual([]); // grace идёт: раскрытия ещё нет
    expect((await get(s.block.id, s.person.id)).status).toBe(404);
    await engine().processTimers(new Date(at(24 * H).getTime() - 1));
    expect((await get(s.block.id, s.person.id)).status).toBe(404); // за мгновение до deadline

    await engine().processTimers(at(24 * H));
    const items = await list(s.person.id);
    expect(items.status).toBe(200);
    expect(items.body).toEqual([{ block_id: s.block.id, vault_id: s.vault.id, finalized_at: at(24 * H).toISOString(), size: Buffer.byteLength(CIPHER) }]);

    const got = await get(s.block.id, s.person.id);
    expect(got.status).toBe(200);
    expect(got.body).toEqual({
      block_id: s.block.id,
      vault_id: s.vault.id,
      ciphertext: CIPHER,
      dek_wrapped_for_recipient: WRAP,
      key_fingerprint: fp(PERSON_KEY),
      finalized_at: at(24 * H).toISOString(),
    });
    // ничего от владельца: ни ключа блока под ключом сейфа, ни ключа сейфа
    expect(JSON.stringify([items.body, got.body])).not.toContain(SAMPLE.keyEnvelope);
    expect(await ctx.db.auditLog.count({ where: { action: 'block_delivered' } })).toBe(1);
  });

  it('answers with Cache-Control: no-store', async () => {
    const s = await scene();
    await arm(s);
    await release(s);
    const token = ctx.moduleRef.get(AuthService).sign(s.person.id);
    for (const path of ['/recipients/me/deliveries', `/recipients/me/deliveries/${s.block.id}`]) {
      const res = await fetch(`${ctx.baseUrl}${path}`, { headers: { authorization: `Bearer ${token}` } });
      expect([path, res.status, res.headers.get('cache-control')]).toEqual([path, 200, 'no-store']);
    }
  });

  it('nobody else gets anything after the release: owner, verifiers, outsiders, platform admin, anonymous', async () => {
    const s = await scene();
    await arm(s);
    await release(s);
    expect((await list()).status).toBe(401);
    expect((await get(s.block.id)).status).toBe(401);
    for (const [label, id] of [['owner', s.owner.id], ['verifier 1', s.v1.user.id], ['verifier 2', s.v2.user.id], ['outsider', s.outsider.id], ['admin', s.admin.id], ['other recipient without an assignment', s.other.id]] as const) {
      expect([label, (await list(id)).body]).toEqual([label, []]);
      expect([label, (await get(s.block.id, id)).status]).toEqual([label, 404]);
    }
  });

  it('is closed before the release in every other way: cancelled, rejected, still waiting for votes', async () => {
    const s = await scene();
    await arm(s);
    expect((await start(s)).status).toBe(201);
    expect((await get(s.block.id, s.person.id)).status).toBe(404); // голосов ещё нет
    await vote(s, s.v1.user.id, 'Confirm');
    expect((await get(s.block.id, s.person.id)).status).toBe(404); // кворума нет
    await vote(s, s.v2.user.id, 'Confirm');
    expect((await cancel(s)).status).toBe(201); // «Я жив»
    expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).status).toBe('Active');
    await engine().processTimers(at(100 * H));
    expect((await list(s.person.id)).body).toEqual([]);
    expect((await get(s.block.id, s.person.id)).status).toBe(404);
  });

  it('a vault flagged Released without a finalized event, or a finalized event of a vault that is not Released, delivers nothing', async () => {
    const s = await scene();
    await arm(s);
    await ctx.db.vault.update({ where: { id: s.vault.id }, data: { status: 'Released' } });
    expect((await get(s.block.id, s.person.id)).status).toBe(404); // статус сам по себе права не даёт
    await ctx.db.vault.update({ where: { id: s.vault.id }, data: { status: 'Active' } });
    await ctx.db.verificationEvent.create({ data: { vaultId: s.vault.id, state: 'Finalized', quorumRequired: 2, finalizedAt: new Date() } });
    expect((await get(s.block.id, s.person.id)).status).toBe(404); // событие само по себе тоже
  });

  it('needs the key confirmed by the owner and a wrapping made for exactly that key', async () => {
    const s = await scene();
    await arm(s);
    await release(s);
    expect((await get(s.block.id, s.person.id)).status).toBe(200);

    // получатель сменил ключ уже после раскрытия: подтверждение сброшено, упаковка под прежний ключ недействительна
    expect((await ctx.request('PUT', '/recipients/me/key', { pubkey: rsaSpki('person-new') }, s.person.id)).status).toBe(200);
    expect((await list(s.person.id)).body).toEqual([]);
    expect((await get(s.block.id, s.person.id)).status).toBe(404);

    // и если подтверждение вернули, а упаковки под новый ключ нет — всё равно ничего
    await ctx.request('POST', `/recipients/${s.recipient.id}/confirm-key`, { key_fingerprint: fp(rsaSpki('person-new')) }, s.owner.id);
    expect((await get(s.block.id, s.person.id)).status).toBe(404);
  });

  it('only the assigned blocks, only text blocks with a ciphertext, never deleted ones', async () => {
    const s = await scene();
    const second = (await ctx.request('POST', '/blocks', blockBody(s.vault.id, { ciphertext: `v1.${'B'.repeat(16)}.${'T'.repeat(60)}` }), s.owner.id)).body;
    const third = (await ctx.request('POST', '/blocks', blockBody(s.vault.id), s.owner.id)).body; // не назначен
    const legacy = await ctx.db.block.create({ data: { vaultId: s.vault.id, type: 'text', dekWrapped: 'dek', tags: [] } }); // без шифротекста
    await arm(s);
    for (const b of [second.id, legacy.id]) {
      expect((await ctx.request('POST', `/blocks/${b}/recipients`, { recipient_id: s.recipient.id, dek_wrapped_for_recipient: WRAP, key_fingerprint: fp(PERSON_KEY) }, s.owner.id)).status).toBe(201);
    }
    await release(s);

    const items = (await list(s.person.id)).body.map((i: any) => i.block_id).sort();
    expect(items).toEqual([s.block.id, second.id].sort());
    expect((await get(third.id, s.person.id)).status).toBe(404); // не назначен
    expect((await get(legacy.id, s.person.id)).status).toBe(404); // нечего расшифровывать

    // удалённый блок не выдаётся
    expect((await ctx.request('DELETE', `/blocks/${second.id}`, undefined, s.owner.id)).status).toBe(200);
    expect((await list(s.person.id)).body.map((i: any) => i.block_id)).toEqual([s.block.id]);
    expect((await get(second.id, s.person.id)).status).toBe(404);
  });

  it('the address of the recipient decides, per vault: the same address in a vault that is not released gets nothing from it', async () => {
    const s = await scene();
    await arm(s);
    const otherOwner = await ctx.factory.createUser({ email: 'owner-2@test.local' });
    const vault2 = await ctx.factory.createVault(otherOwner.id);
    const block2 = (await ctx.request('POST', '/blocks', blockBody(vault2.id, { ciphertext: `v1.${'C'.repeat(16)}.${'U'.repeat(60)}` }), otherOwner.id)).body;
    const r2 = (await ctx.request('POST', '/recipients', { vault_id: vault2.id, contact: 'person@test.local' }, otherOwner.id)).body;
    // получатель, назначенный после заявки ключа, получает его повторной заявкой; потом владелец второго сейфа подтверждает и упаковывает
    expect((await ctx.request('PUT', '/recipients/me/key', { pubkey: PERSON_KEY }, s.person.id)).body).toMatchObject({ recipients: 2 });
    expect((await ctx.request('POST', `/recipients/${r2.id}/confirm-key`, { key_fingerprint: fp(PERSON_KEY) }, otherOwner.id)).status).toBe(201);
    expect((await ctx.request('POST', `/blocks/${block2.id}/recipients`, { recipient_id: r2.id, dek_wrapped_for_recipient: WRAP, key_fingerprint: fp(PERSON_KEY) }, otherOwner.id)).status).toBe(201);

    await release(s); // раскрыт только первый сейф
    const items = (await list(s.person.id)).body;
    expect(items.map((i: any) => i.vault_id)).toEqual([s.vault.id]);
    expect((await get(block2.id, s.person.id)).status).toBe(404);
  });

  it('an account without a verified address gets 403 even with the matching e-mail', async () => {
    const s = await scene();
    await arm(s);
    await release(s);
    await ctx.db.user.update({ where: { id: s.person.id }, data: { emailVerifiedAt: null } });
    expect((await list(s.person.id)).status).toBe(403);
    expect((await get(s.block.id, s.person.id)).status).toBe(403);
  });

  it('a malformed block id is 400', async () => {
    const s = await scene();
    expect((await get('not-a-uuid', s.person.id)).status).toBe(400);
  });
});
