import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

const DAY = 24 * 3600 * 1000;

describe('core flow: heartbeat', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('uses one threshold (vault setting); overdue is informational and creates no events', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id);

    const cfg = await ctx.request('PATCH', `/vaults/${vault.id}/heartbeat`, { timeout_days: 1, method: 'manual' }, owner.id);
    expect(cfg.status).toBe(200);
    expect(cfg.body.timeout_days).toBe(1);
    expect((await ctx.db.vault.findUniqueOrThrow({ where: { id: vault.id } })).heartbeatTimeoutDays).toBe(1);

    const ping = await ctx.request('POST', '/heartbeats/ping', { vault_id: vault.id, method: 'manual' }, owner.id);
    expect(ping.status).toBe(201);
    expect(ping.body.overdue).toBe(false);

    ctx.clock.setNow(new Date(Date.now() + 2 * DAY));
    const later = await ctx.request('GET', `/vaults/${vault.id}/heartbeat`, undefined, owner.id);
    expect(later.body.overdue).toBe(true);

    // неактивность сама по себе ничего не запускает и не раскрывает
    expect(await ctx.db.verificationEvent.count()).toBe(0);
  });

  it('returns 403 for a foreign vault heartbeat config', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+hb-neg@test.local' });
    const other = await ctx.factory.createUser({ email: 'other+hb@test.local' });
    const vault = await ctx.factory.createVault(owner.id);

    const forbidden = await ctx.request('GET', `/vaults/${vault.id}/heartbeat`, undefined, other.id);
    expect(forbidden.status).toBe(403);
    const ping = await ctx.request('POST', '/heartbeats/ping', { vault_id: vault.id }, other.id);
    expect(ping.status).toBe(403);
  });
});
