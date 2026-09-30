import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { OrchestratorService } from '../../src/orchestrator/orchestrator.service';
import { bootstrapE2eApp, closeE2eApp, mapState } from './test-helper';

describe('core flow: verification events', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2eApp>>;

  beforeEach(async () => {
    ctx = await bootstrapE2eApp();
    ctx.time.freeze('2026-01-01T00:00:00.000Z');
  });

  afterEach(async () => {
    if (ctx) await closeE2eApp(ctx.app, ctx.time);
  });

  it('transitions pending -> grace -> finalized with two independent verifier confirmations', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2, graceHours: 24 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    const v2 = await ctx.factory.createVerifier(vault.id);

    const start = await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);
    expect(start.status).toBe(201);

    // каждый голос — от своей сессии; автор берётся только из токена
    const d1 = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      decision: 'Confirm',
      signature: 'sig-1',
    }, v1.user.id);
    expect(d1.status).toBe(201);
    expect(mapState(d1.body.state)).toBe('pending');
    expect(d1.body).toEqual(expect.objectContaining({ confirms: 1, denies: 0, quorum: 2 }));

    const d2 = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      decision: 'Confirm',
      signature: 'sig-2',
    }, v2.user.id);
    expect(d2.status).toBe(201);
    expect(d2.body).toEqual(expect.objectContaining({ confirms: 2, denies: 0, quorum: 2 }));

    expect(ctx.prisma.decisions.map((d: any) => d.userId).sort()).toEqual([v1.user.id, v2.user.id].sort());

    const svc = ctx.moduleRef.get(OrchestratorService);
    const toGrace = await svc.processTimers(new Date());
    expect(toGrace.finalized).toBe(0);

    const graceEvent = ctx.prisma.events.find((e: any) => e.vaultId === vault.id);
    expect(mapState(graceEvent.state)).toBe('grace');

    ctx.time.advanceHours(25);
    const sweep = await svc.processTimers(new Date());
    expect(sweep.finalized).toBeGreaterThanOrEqual(1);

    const events = await ctx.request('GET', `/verification-events?vault_id=${vault.id}`, undefined, owner.id);
    expect(events.status).toBe(200);
    expect(mapState(events.body[0].state)).toBe('finalized');
  });

  it('owner cannot vote for verifiers: one person is one vote', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve-one@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);
    await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);

    const asOwner = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      decision: 'Confirm',
    }, owner.id);
    expect(asOwner.status).toBe(403);

    const spoofed = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      user_id: v1.user.id,
      decision: 'Confirm',
    }, owner.id);
    expect(spoofed.status).toBe(400);
    expect(ctx.prisma.decisions).toHaveLength(0);
  });

  it('returns 4xx for negative decisions', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+ve-neg@test.local' });
    const outsider = await ctx.factory.createUser({ email: 'outsider@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { quorumThreshold: 2 });
    const v1 = await ctx.factory.createVerifier(vault.id);

    const noActive = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      decision: 'Confirm',
    }, v1.user.id);
    expect(noActive.status).toBe(400);

    await ctx.request('POST', '/orchestration/start', { vault_id: vault.id }, owner.id);

    const forbidden = await ctx.request('POST', '/orchestration/decision', {
      vault_id: vault.id,
      decision: 'Confirm',
    }, outsider.id);
    expect(forbidden.status).toBe(403);
  });
});
