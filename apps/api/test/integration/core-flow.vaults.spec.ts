import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

describe('core flow: vaults', () => {
  let ctx: Ctx;

  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('creates vault and returns deterministic structure', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+vault@test.local' });

    const createRes = await ctx.request('POST', '/vaults', {
      name: 'Family Vault',
      quorum_threshold: 2,
      grace_hours: 24,
    }, owner.id);

    expect(createRes.status).toBe(201);
    expect(createRes.body).toEqual(expect.objectContaining({
      id: expect.any(String),
      userId: owner.id,
      name: 'Family Vault',
      status: 'Active',
      quorumThreshold: 2,
      graceHours: 24,
    }));

    const listRes = await ctx.request('GET', '/vaults', undefined, owner.id);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0]).toEqual(expect.objectContaining({
      id: createRes.body.id,
      userId: owner.id,
      mkWrapped: expect.any(String),
    }));
  });

  it('does not show a vault to another user', async () => {
    const owner = await ctx.factory.createUser();
    const other = await ctx.factory.createUser();
    const vault = await ctx.factory.createVault(owner.id);
    expect((await ctx.request('GET', `/vaults/${vault.id}`, undefined, other.id)).status).toBe(404);
    expect((await ctx.request('GET', '/vaults', undefined, other.id)).body).toEqual([]);
  });

  it('returns 404 for an unknown vault and 400 for a malformed id', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+vault404@test.local' });
    const unknown = await ctx.request('GET', '/vaults/6b1d2d6e-7a51-4d0a-9d47-3f3f5b0e0000', undefined, owner.id);
    expect(unknown.status).toBe(404);
    const malformed = await ctx.request('GET', '/vaults/not-exists', undefined, owner.id);
    expect(malformed.status).toBe(400);
  });
});
