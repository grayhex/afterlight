import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HeartbeatProcessor } from '../../src/heartbeats/heartbeats.processor';
import { bootstrapE2eApp, closeE2eApp, mapState } from './test-helper';

describe('core flow: heartbeat', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2eApp>>;

  beforeEach(async () => {
    ctx = await bootstrapE2eApp();
    ctx.time.freeze('2026-01-01T00:00:00.000Z');
  });

  afterEach(async () => {
    if (ctx) await closeE2eApp(ctx.app, ctx.time);
  });

  it('marks event as rejected_by_heartbeat when overdue', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { heartbeatTimeoutDays: 1 });

    await ctx.request('PATCH', `/vaults/${vault.id}/heartbeat`, { timeout_days: 1, method: 'manual' }, owner.id);
    await ctx.request('POST', '/heartbeats/ping', { vault_id: vault.id, method: 'manual' }, owner.id);

    ctx.time.advanceHours(25);
    const processor = ctx.moduleRef.get(HeartbeatProcessor);
    await (processor as any).tick();

    const created = ctx.prisma.events.find((e: any) => e.vaultId === vault.id && e.state === 'HeartbeatTimeout');
    expect(created).toBeDefined();
    expect(mapState(created.state)).toBe('rejected_by_heartbeat');
  });

  it('returns 4xx for foreign vault heartbeat config', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb-neg@test.local' });
    const other = await ctx.factory.createUser({ email: 'other+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id);

    const forbidden = await ctx.request('GET', `/vaults/${vault.id}/heartbeat`, undefined, other.id);
    expect(forbidden.status).toBe(403);
  });
});
