import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service';
import { bootstrapApp, closeApp, Ctx, HOUR } from './helper';

describe('core flow: verification events', () => {
  let ctx: Ctx;

  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('goes Submitted -> QuorumReached -> Grace -> Finalized with two independent verifier confirmations', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2, graceHours: 24 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);

    const start = await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
    expect(start.status).toBe(201);

    // каждый голос — от своей сессии; автор берётся только из токена
    const d1 = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id, decision: 'Confirm', signature: 'sig-1',
    }, v1.user.id);
    expect(d1.status).toBe(201);
    expect(d1.body).toEqual(expect.objectContaining({ state: 'Confirming', confirms: 1, denies: 0, quorum: 2 }));

    const d2 = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id, decision: 'Confirm', signature: 'sig-2',
    }, v2.user.id);
    expect(d2.status).toBe(201);
    expect(d2.body).toEqual(expect.objectContaining({ state: 'QuorumReached', confirms: 2, denies: 0, quorum: 2 }));

    const decisions = await ctx.db.verificationDecision.findMany();
    expect(decisions.map((d) => d.userId).sort()).toEqual([v1.user.id, v2.user.id].sort());

    const svc = ctx.moduleRef.get(OrchestratorService);
    const toGrace = await svc.processTimers(new Date());
    expect(toGrace.finalized).toBe(0);
    expect((await ctx.db.verificationEvent.findFirstOrThrow({ where: { vaultId: vault.id } })).state).toBe('Grace');
    expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: vault.id } })).status).toBe('PendingGrace');

    const sweep = await svc.processTimers(new Date(Date.now() + 25 * HOUR));
    expect(sweep.finalized).toBe(1);

    const events = await ctx.request('GET', `/verification-events?vault_id=${vault.id}`, undefined, owner.id);
    expect(events.status).toBe(200);
    expect(events.body[0]).toEqual(expect.objectContaining({ state: 'Finalized', confirmsCount: 2 }));
    expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: vault.id } })).status).toBe('Released');
  });

  it('owner cannot vote for verifiers: one person is one vote', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve-one@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);

    const asOwner = await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, owner.id);
    expect(asOwner.status).toBe(403);

    const spoofed = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id, user_id: v1.user.id, decision: 'Confirm',
    }, owner.id);
    expect(spoofed.status).toBe(400);
    expect(await ctx.db.verificationDecision.count()).toBe(0);
  });

  it('returns 4xx for negative decisions', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve-neg@test.local' });
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);

    const noActive = await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, v1.user.id);
    expect(noActive.status).toBe(400);

    await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);

    const forbidden = await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, outsider.id);
    expect(forbidden.status).toBe(403);
  });

  it('confirm and deny from two verifiers put the event into a dispute lock', async () => {
    const owner = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);
    await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
    await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, v1.user.id);
    const deny = await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Deny' }, v2.user.id);
    expect(deny.body.state).toBe('Disputed');
    const again = await ctx.request('POST', '/orchestration/decision', { vault_id: vault.id, decision: 'Confirm' }, v2.user.id);
    expect(again.status).toBe(409);
  });
});
