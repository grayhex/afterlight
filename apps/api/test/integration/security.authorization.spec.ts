import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service';
import { bootstrapApp, closeApp, Ctx, HOUR } from './helper';

describe('security: object authorization (real AuthGuard, real PostgreSQL, synthetic accounts)', () => {
  let ctx: Ctx;

  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  async function scene() {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const otherOwner = await ctx.factory.createUser({ email: 'other-owner@test.local' });
    const otherVault = await ctx.factory.createVault(otherOwner.id, { quorumThreshold: 2 });
    const otherVerifier = await ctx.factory.createVerifier(otherVault.id);
    return { owner, vault, v1, v2, outsider, otherOwner, otherVault, otherVerifier };
  }

  async function startEvent(s: Awaited<ReturnType<typeof scene>>) {
    const res = await ctx.request('POST', '/orchestration/start', { vault_id: s.vault.id }, s.owner.id);
    expect(res.status).toBe(201);
    return res.body.id as string;
  }

  describe('authentication', () => {
    it('rejects anonymous callers on protected routes', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      const calls: Array<[string, string, unknown?]> = [
        ['GET', '/vaults'],
        ['GET', `/verification-events?vault_id=${s.vault.id}`],
        ['GET', `/verification-events/${eventId}`],
        ['POST', `/verification-events/${eventId}/confirm`, {}],
        ['POST', '/orchestration/start', { vault_id: s.vault.id }],
        ['POST', '/orchestration/decision', { vault_id: s.vault.id, decision: 'Confirm' }],
        ['GET', `/verifiers?vault_id=${s.vault.id}`],
        ['POST', '/verifiers/invitations/accept', { token: 'x'.repeat(32) }],
        ['GET', '/auth/me'],
        ['GET', '/audit-logs'],
      ];
      for (const [method, path, body] of calls) {
        const res = await ctx.request(method, path, body);
        expect([method, path, res.status]).toEqual([method, path, 401]);
      }
    });

    it('rejects a token signed with another secret and a token without subject', async () => {
      const s = await scene();
      const forged = jwt.sign({ sub: s.owner.id }, 'not-the-server-secret', { expiresIn: '1h' });
      expect((await ctx.request('GET', '/vaults', undefined, undefined, forged)).status).toBe(401);
      const noSub = jwt.sign({ foo: 'bar' }, process.env.JWT_SECRET as string, { expiresIn: '1h' });
      expect((await ctx.request('GET', '/vaults', undefined, undefined, noSub)).status).toBe(401);
    });

    it('keeps only explicit public routes open', async () => {
      expect((await ctx.request('GET', '/healthz')).status).toBe(200);
      const bad = await ctx.request('POST', '/auth/login', { email: 'nobody@test.local', password: 'x' });
      expect(bad.status).toBe(401); // дошли до обработчика, а не отсеяны guard-ом по другой причине
      expect((await ctx.request('GET', '/p/some-token')).status).toBe(401);
    });
  });

  describe('voting: author comes only from the session', () => {
    it('two independently authenticated active verifiers reach quorum', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      const a = await ctx.request('POST', `/verification-events/${eventId}/confirm`, { signature: 'a' }, s.v1.user.id);
      expect(a.status).toBe(201);
      expect(a.body).toEqual(expect.objectContaining({ id: eventId, confirmsCount: 1, quorumRequired: 2 }));
      const b = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v2.user.id);
      expect(b.status).toBe(201);
      expect(b.body).toEqual(expect.objectContaining({ state: 'QuorumReached', confirmsCount: 2 }));
    });

    it('voting via /verification-events returns the updated event (id, counters) that the cabinet renders', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      const res = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v1.user.id);
      expect(res.status).toBe(201);
      expect(res.body).toEqual(expect.objectContaining({ id: eventId, state: 'Confirming', confirmsCount: 1, deniesCount: 0 }));
    });

    it('the old confirm/deny URLs with a user id in the path no longer exist', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      for (const action of ['confirm', 'deny']) {
        const res = await ctx.request('POST', `/verification-events/${eventId}/${action}/${s.v2.user.id}`, {}, s.owner.id);
        expect(res.status).toBe(404);
      }
      expect(await ctx.db.verificationDecision.count()).toBe(0);
    });

    it('rejects an attempt to set another author in the body on both APIs', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      const legacy = await ctx.request('POST', `/verification-events/${eventId}/confirm`, { user_id: s.v2.user.id }, s.v1.user.id);
      expect(legacy.status).toBe(400);
      const modern = await ctx.request('POST', '/orchestration/decision', {
        vault_id: s.vault.id, user_id: s.v2.user.id, decision: 'Confirm',
      }, s.v1.user.id);
      expect(modern.status).toBe(400);
      expect(await ctx.db.verificationDecision.count()).toBe(0);
    });

    it.each([
      ['anonymous', undefined],
      ['outsider', 'outsider'],
      ['verifier of another vault', 'otherVerifier'],
      ['vault owner', 'owner'],
    ])('rejects a vote from %s on both APIs', async (_label, who) => {
      const s = await scene();
      const eventId = await startEvent(s);
      const actor: any = who === 'otherVerifier' ? s.otherVerifier.user : (s as any)[who as string];
      const userId = who ? actor.id : undefined;
      const expected = who ? 403 : 401;

      const legacy = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, userId);
      const modern = await ctx.request('POST', '/orchestration/decision', { vault_id: s.vault.id, decision: 'Confirm' }, userId);
      expect(legacy.status).toBe(expected);
      expect(modern.status).toBe(expected);
      expect(await ctx.db.verificationDecision.count()).toBe(0);
    });

    it.each(['Revoked', 'Invited'] as const)('rejects a vote from a %s member on both APIs', async (status) => {
      const s = await scene();
      const inactive = await ctx.factory.createVerifier(s.vault.id, { status });
      const eventId = await startEvent(s);
      const legacy = await ctx.request('POST', `/verification-events/${eventId}/deny`, {}, inactive.user.id);
      const modern = await ctx.request('POST', '/orchestration/decision', { vault_id: s.vault.id, decision: 'Deny' }, inactive.user.id);
      expect(legacy.status).toBe(403);
      expect(modern.status).toBe(403);
      expect(await ctx.db.verificationDecision.count()).toBe(0);
    });

    it('does not accept a vote once the event left the voting states', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v1.user.id);
      await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v2.user.id); // QuorumReached
      const late = await ctx.request('POST', `/verification-events/${eventId}/deny`, {}, s.v1.user.id);
      expect(late.status).toBe(409);
    });

    it('a vote of a later-revoked verifier stops counting towards quorum', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v1.user.id);

      const revoke = await ctx.request('POST', `/verifiers/${s.vault.id}/${s.v1.user.id}/revoke`, undefined, s.owner.id);
      expect(revoke.status).toBe(201);

      const b = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, s.v2.user.id);
      expect(b.status).toBe(201);
      expect(b.body).toEqual(expect.objectContaining({ confirmsCount: 1, quorumRequired: 2 }));
      expect(b.body.state).not.toBe('QuorumReached');

      const svc = ctx.moduleRef.get(OrchestratorService);
      await svc.processTimers(new Date());
      expect((await ctx.db.verificationEvent.findUniqueOrThrow({ where: { id: eventId } })).state).not.toBe('Grace');
    });
  });

  describe('events: reading and starting', () => {
    it('lists only events of vaults the caller belongs to', async () => {
      const s = await scene();
      await startEvent(s);
      await ctx.request('POST', '/orchestration/start', { vault_id: s.otherVault.id }, s.otherOwner.id);

      const own = await ctx.request('GET', '/verification-events', undefined, s.v1.user.id);
      expect(own.status).toBe(200);
      expect(own.body).toHaveLength(1);
      expect(own.body[0].vaultId).toBe(s.vault.id);

      const none = await ctx.request('GET', '/verification-events', undefined, s.outsider.id);
      expect(none.body).toEqual([]);

      const byVault = await ctx.request('GET', `/verification-events?vault_id=${s.vault.id}`, undefined, s.outsider.id);
      expect(byVault.status).toBe(403);
    });

    it('as=verifier lists only vaults where the caller is an active verifier, not their own', async () => {
      const s = await scene();
      await startEvent(s);
      // владелец сам — верификатор чужого сейфа
      await ctx.factory.createVerifier(s.otherVault.id).then(async (v) => {
        await (ctx.prisma as any).vaultUserRole.update({
          where: { vaultId_userId: { vaultId: s.otherVault.id, userId: v.user.id } },
          data: { status: 'Revoked' },
        });
      });
      await ctx.prisma.vaultUserRole.create({ data: { vaultId: s.otherVault.id, userId: s.owner.id, role: 'Verifier', status: 'Active' } });
      await ctx.request('POST', '/orchestration/start', { vault_id: s.otherVault.id }, s.otherOwner.id);

      const asVerifier = await ctx.request('GET', '/verification-events?as=verifier', undefined, s.owner.id);
      expect(asVerifier.status).toBe(200);
      expect(asVerifier.body.map((e: any) => e.vaultId)).toEqual([s.otherVault.id]);

      const all = await ctx.request('GET', '/verification-events', undefined, s.owner.id);
      expect(all.body.map((e: any) => e.vaultId).sort()).toEqual([s.vault.id, s.otherVault.id].sort());

      expect((await ctx.request('GET', '/verification-events?as=admin', undefined, s.owner.id)).status).toBe(400);
    });

    it('does not show a single event to non-members', async () => {
      const s = await scene();
      const eventId = await startEvent(s);
      expect((await ctx.request('GET', `/verification-events/${eventId}`, undefined, s.outsider.id)).status).toBe(403);
      expect((await ctx.request('GET', `/verification-events/${eventId}`, undefined, s.otherVerifier.user.id)).status).toBe(403);
      expect((await ctx.request('GET', `/verification-events/${eventId}`, undefined, s.v1.user.id)).status).toBe(200);
    });

    it.each(['outsider', 'v1', 'otherOwner'])('%s cannot start an event on someone else\'s vault via either API', async (who) => {
      const s = await scene();
      const actor: any = (s as any)[who];
      const userId = actor.user?.id ?? actor.id;
      const a = await ctx.request('POST', '/verification-events', { vault_id: s.vault.id }, userId);
      const b = await ctx.request('POST', '/orchestration/start', { vault_id: s.vault.id }, userId);
      expect(a.status).toBe(403);
      expect(b.status).toBe(403);
      expect(await ctx.db.verificationEvent.count()).toBe(0);
    });

    it('the legacy start endpoint goes through the same orchestrator rules', async () => {
      const s = await scene();
      const res = await ctx.request('POST', '/verification-events', { vault_id: s.vault.id }, s.owner.id);
      expect(res.status).toBe(201);
      expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: s.vault.id } })).status).toBe('Triggered');
    });

    it('rejects malformed ids with 400 instead of reaching the database', async () => {
      const s = await scene();
      expect((await ctx.request('GET', '/verification-events/not-a-uuid', undefined, s.owner.id)).status).toBe(400);
      expect((await ctx.request('GET', '/verification-events?vault_id=zzz', undefined, s.owner.id)).status).toBe(400);
    });
  });

  describe('invitations', () => {
    async function invite(s: Awaited<ReturnType<typeof scene>>, email = 'new.verifier@test.local', asUser = s.owner.id, hours?: number) {
      return ctx.request('POST', '/verifiers/invitations', {
        vault_id: s.vault.id, email, ...(hours ? { expires_in_hours: hours } : {}),
      }, asUser);
    }

    it.each(['outsider', 'v1', 'otherOwner'])('%s cannot invite into the vault', async (who) => {
      const s = await scene();
      const actor: any = (s as any)[who];
      const res = await invite(s, 'x@test.local', actor.user?.id ?? actor.id);
      expect(res.status).toBe(403);
      expect(await ctx.db.vaultUserInvitation.count()).toBe(0);
    });

    it('owner invites: token goes only to the mailbox, is stored hashed, is not in the response', async () => {
      const s = await scene();
      const res = await invite(s);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        id: expect.any(String), email: 'new.verifier@test.local', role: 'Verifier', expires_at: expect.any(String),
      });

      const tokens = await ctx.invitationTokens('new.verifier@test.local');
      expect(tokens).toHaveLength(1);
      const token = tokens[0];
      expect(token.length).toBeGreaterThanOrEqual(43);
      expect(JSON.stringify(res.body)).not.toContain(token);
      const stored = await ctx.db.vaultUserInvitation.findFirstOrThrow();
      expect(stored.token).not.toBe(token);
      expect(stored.token).toBe(createHash('sha256').update(token).digest('hex'));
      // приглашение не создаёт учётную запись за адресата и не делает его участником
      expect(await ctx.db.user.findUnique({ where: { email: 'new.verifier@test.local' } })).toBeNull();
    });

    it('does not invite the vault owner, duplicates or existing members', async () => {
      const s = await scene();
      expect((await invite(s, 'OWNER@test.local')).status).toBe(400);
      expect((await invite(s)).status).toBe(201);
      expect((await invite(s, 'New.Verifier@test.local')).status).toBe(409);
      expect((await invite(s, s.v1.user.email)).status).toBe(409);
    });

    it('addressee accepts with the token and then can vote; the invitation is one-time', async () => {
      const s = await scene();
      const invitee = await ctx.factory.createUser({ email: 'new.verifier@test.local' });
      await invite(s);
      const token = (await ctx.invitationTokens('new.verifier@test.local'))[0];

      const eventId = await startEvent(s);
      const before = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, invitee.id);
      expect(before.status).toBe(403); // приглашён, но ещё не активирован

      const ok = await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id);
      expect(ok.status).toBe(201);
      expect(ok.body).toEqual(expect.objectContaining({ user_id: invitee.id, role: 'Verifier', status: 'Active' }));

      const vote = await ctx.request('POST', `/verification-events/${eventId}/confirm`, {}, invitee.id);
      expect(vote.status).toBe(201);

      const replay = await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id);
      expect(replay.status).toBe(410);
    });

    it('another signed-in user cannot use the token and does not burn it', async () => {
      const s = await scene();
      const invitee = await ctx.factory.createUser({ email: 'new.verifier@test.local' });
      await invite(s);
      const token = (await ctx.invitationTokens('new.verifier@test.local'))[0];

      for (const intruder of [s.outsider, s.v1.user, s.owner]) {
        const res = await ctx.request('POST', '/verifiers/invitations/accept', { token }, intruder.id);
        expect(res.status).toBe(403);
      }
      expect(await ctx.db.vaultUserRole.count({ where: { vaultId: s.vault.id, userId: s.outsider.id } })).toBe(0);
      expect((await ctx.db.vaultUserInvitation.findFirstOrThrow()).acceptedAt).toBeNull();

      const ok = await ctx.request('POST', '/verifiers/invitations/accept', { token }, invitee.id);
      expect(ok.status).toBe(201);
    });

    it('unknown, expired and revoked invitations are not accepted', async () => {
      const s = await scene();
      const invitee = await ctx.factory.createUser({ email: 'new.verifier@test.local' });

      const unknown = await ctx.request('POST', '/verifiers/invitations/accept', { token: 'z'.repeat(43) }, invitee.id);
      expect(unknown.status).toBe(404);

      await invite(s, 'new.verifier@test.local', s.owner.id, 1);
      const expiredToken = (await ctx.invitationTokens('new.verifier@test.local'))[0];
      await ctx.db.vaultUserInvitation.updateMany({ data: { expiresAt: new Date(Date.now() - HOUR) } });
      const expired = await ctx.request('POST', '/verifiers/invitations/accept', { token: expiredToken }, invitee.id);
      expect(expired.status).toBe(410);

      const again = await invite(s, 'new.verifier@test.local');
      expect(again.status).toBe(201);
      const freshToken = (await ctx.invitationTokens('new.verifier@test.local'))[1];
      const revoke = await ctx.request('DELETE', `/verifiers/invitations/${again.body.id}`, undefined, s.owner.id);
      expect(revoke.status).toBe(200);
      const revoked = await ctx.request('POST', '/verifiers/invitations/accept', { token: freshToken }, invitee.id);
      expect(revoked.status).toBe(410);
      expect(await ctx.db.vaultUserRole.count({ where: { userId: invitee.id } })).toBe(0);
    });

    it('only a manager can revoke an invitation or a member', async () => {
      const s = await scene();
      const created = await invite(s);
      const del = await ctx.request('DELETE', `/verifiers/invitations/${created.body.id}`, undefined, s.v1.user.id);
      expect(del.status).toBe(403);
      const rev = await ctx.request('POST', `/verifiers/${s.vault.id}/${s.v2.user.id}/revoke`, undefined, s.v1.user.id);
      expect(rev.status).toBe(403);
      expect((await ctx.db.vaultUserRole.findFirstOrThrow({ where: { userId: s.v2.user.id } })).status).toBe('Active');
    });
  });

  describe('response DTOs do not expose internals', () => {
    it('GET /verifiers returns an explicit safe shape and only to managers', async () => {
      const s = await scene();
      await ctx.db.user.update({
        where: { id: s.v1.user.id },
        data: { passwordHash: 'bcrypt-hash-should-not-leak', passkeyPub: 'passkey-should-not-leak' },
      });
      await ctx.request('POST', '/verifiers/invitations', { vault_id: s.vault.id, email: 'p@test.local' }, s.owner.id);

      const res = await ctx.request('GET', `/verifiers?vault_id=${s.vault.id}`, undefined, s.owner.id);
      expect(res.status).toBe(200);
      const raw = JSON.stringify(res.body);
      expect(raw).not.toContain('bcrypt-hash-should-not-leak');
      expect(raw).not.toContain('passkey-should-not-leak');
      expect(raw).not.toContain((await ctx.invitationTokens('p@test.local'))[0]);
      expect(raw).not.toMatch(/passwordHash|password_hash|token/i);
      for (const row of res.body) {
        expect(Object.keys(row).sort()).toEqual(
          ['added_at', 'email', 'expires_at', 'invitation_id', 'is_primary', 'name', 'role', 'status', 'user_id'],
        );
      }
      expect(res.body.find((r: any) => r.email === 'p@test.local').status).toBe('Invited');

      expect((await ctx.request('GET', `/verifiers?vault_id=${s.vault.id}`, undefined, s.v1.user.id)).status).toBe(403);
      expect((await ctx.request('GET', `/verifiers?vault_id=${s.vault.id}`, undefined, s.outsider.id)).status).toBe(403);
    });
  });

  describe('service-level routes', () => {
    it('audit log, subscriptions and plan writes are admin-only', async () => {
      const s = await scene();
      const admin = await ctx.factory.createUser({ email: 'admin@test.local', role: 'Admin' });
      for (const [method, path, body] of [
        ['GET', '/audit-logs'],
        ['POST', '/audit-logs', { actorType: 'User', actorId: 'x', action: 'forged' }],
        ['GET', '/subscriptions'],
        ['POST', '/plans', { tier: 'Free', limits: {} }],
        ['GET', '/users'],
      ] as Array<[string, string, unknown?]>) {
        const res = await ctx.request(method, path, body, s.owner.id);
        expect([method, path, res.status]).toEqual([method, path, path === '/audit-logs' && method === 'POST' ? 404 : 403]);
      }
      // у администратора платформы остаётся чтение журнала
      const ok = await ctx.request('GET', '/audit-logs', undefined, admin.id);
      expect(ok.status).toBe(200);
    });

    it('recovery shares belong to the vault owner only', async () => {
      const s = await scene();
      const create = await ctx.request('POST', '/recovery-shares', {
        vaultId: s.vault.id, shareIndex: 1, shareCipher: 'c',
      }, s.outsider.id);
      expect(create.status).toBe(403);
      const list = await ctx.request('GET', `/recovery-shares?vault_id=${s.vault.id}`, undefined, s.v1.user.id);
      expect(list.status).toBe(403);
    });

    it('a verifier cannot designate recipients and nobody can overwrite an existing public key', async () => {
      const s = await scene();
      const asVerifier = await ctx.request('POST', '/recipients', { vault_id: s.vault.id, contact: 'r@mail.test' }, s.v1.user.id);
      expect(asVerifier.status).toBe(403);

      const first = await ctx.request('POST', '/recipients', { vault_id: s.vault.id, contact: 'r@mail.test', pubkey: 'KEY-A' }, s.owner.id);
      expect(first.status).toBe(201);
      const swap = await ctx.request('POST', '/recipients', { vault_id: s.otherVault.id, contact: 'r@mail.test', pubkey: 'KEY-EVIL' }, s.otherOwner.id);
      expect(swap.status).toBe(409);
      expect((await ctx.db.recipient.findFirstOrThrow()).pubkey).toBe('KEY-A');
      const same = await ctx.request('POST', '/recipients', { vault_id: s.otherVault.id, contact: 'r@mail.test', pubkey: 'KEY-A' }, s.otherOwner.id);
      expect(same.status).toBe(201);
    });
  });
});
