import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { HeartbeatProcessor } from '../../src/heartbeats/heartbeats.processor';
import { bootstrapApp, closeApp, Ctx, hoursAgo } from './helper';

describe('core flow: heartbeat', () => {
  let ctx: Ctx;

  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('records a HeartbeatTimeout event when the heartbeat is overdue', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id, { heartbeatTimeoutDays: 1 });

    const cfg = await ctx.request('PATCH', `/vaults/${vault.id}/heartbeat`, { timeout_days: 1, method: 'manual' }, owner.id);
    expect(cfg.status).toBe(200);
    const ping = await ctx.request('POST', '/heartbeats/ping', { vault_id: vault.id, method: 'manual' }, owner.id);
    expect(ping.status).toBe(201);
    expect(ping.body.overdue).toBe(false);

    // последний ping был 25 часов назад: состояние задаётся данными, а не подменой часов
    await ctx.db.heartbeat.update({ where: { vaultId: vault.id }, data: { lastPingAt: hoursAgo(25) } });
    await (ctx.moduleRef.get(HeartbeatProcessor) as any).tick();

    const created = await ctx.db.verificationEvent.findMany({ where: { vaultId: vault.id, state: 'HeartbeatTimeout' } });
    expect(created).toHaveLength(1);
  });

  it('returns 403 for a foreign vault heartbeat config', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb-neg@test.local' });
    const other = await ctx.factory.createUser({ email: 'other+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id);

    const forbidden = await ctx.request('GET', `/vaults/${vault.id}/heartbeat`, undefined, other.id);
    expect(forbidden.status).toBe(403);
  });
});
