import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { bootstrapApp, closeApp, Ctx, SAMPLE } from './helper.js';

describe('core flow: public links', () => {
  let ctx: Ctx;

  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('creates public link and returns deterministic payload', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+pl@test.local' });
    const vault = await ctx.factory.createVault(owner.id);

    const blockRes = await ctx.request('POST', '/blocks', {
      vault_id: vault.id,
      type: 'text',
      dek_wrapped: SAMPLE.keyEnvelope,
      ciphertext: SAMPLE.ciphertext,
      tags: ['legal'],
      checksum: 'abc',
    }, owner.id);

    expect(blockRes.status).toBe(201);

    const put = await ctx.request('PUT', `/blocks/${blockRes.body.id}/public`, {
      enabled: true,
      max_views: 1,
    }, owner.id);
    expect(put.status).toBe(200);
    expect(put.body).toEqual(expect.objectContaining({
      block_id: blockRes.body.id,
      enabled: true,
      max_views: 1,
      views_count: 0,
      url: expect.stringContaining('/p/'),
    }));

    const token = String(put.body.url).split('/p/')[1];
    const open1 = await ctx.request('GET', `/p/${token}`, undefined, owner.id);
    expect(open1.status).toBe(200);
    expect(open1.body).toEqual(expect.objectContaining({
      block_id: blockRes.body.id,
      type: 'text',
      tags: ['legal'],
      updated_at: expect.any(String),
    }));

    const open2 = await ctx.request('GET', `/p/${token}`, undefined, owner.id);
    expect([404, 410]).toContain(open2.status);
  });

  it('returns 400 on invalid publish window', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner+pl-neg@test.local' });
    const vault = await ctx.factory.createVault(owner.id);
    const blockRes = await ctx.request('POST', '/blocks', {
      vault_id: vault.id,
      type: 'text',
      dek_wrapped: SAMPLE.keyEnvelope,
      ciphertext: SAMPLE.ciphertext,
    }, owner.id);

    const bad = await ctx.request('PUT', `/blocks/${blockRes.body.id}/public`, {
      enabled: true,
      publish_from: '2026-01-03T00:00:00.000Z',
      publish_until: '2026-01-02T00:00:00.000Z',
    }, owner.id);

    expect(bad.status).toBe(400);
  });
});
