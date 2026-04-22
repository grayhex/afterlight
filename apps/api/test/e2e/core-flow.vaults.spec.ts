import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrapE2eApp, closeE2eApp, mapState } from './test-helper';

describe('core flow: vaults', () => {
  let ctx: Awaited<ReturnType<typeof bootstrapE2eApp>>;

  beforeEach(async () => {
    ctx = await bootstrapE2eApp();
  });

  afterEach(async () => {
    if (ctx) await closeE2eApp(ctx.app, ctx.time);
  });

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
      status: expect.any(String),
      quorumThreshold: 2,
      graceHours: 24,
    }));
    expect(mapState('Submitted')).toBe('pending');

    const listRes = await ctx.request('GET', '/vaults', undefined, owner.id);
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body[0]).toEqual(expect.objectContaining({
      id: createRes.body.id,
      userId: owner.id,
      mkWrapped: expect.any(String),
    }));
  });

  it('returns 404 for unknown vault', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+vault404@test.local' });
    const res = await ctx.request('GET', '/vaults/not-exists', undefined, owner.id);
    expect(res.status).toBe(404);
  });
});
