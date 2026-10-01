import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { hashPassword } from '../../src/auth/password.js';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

const ENV_KEYS = ['TRUST_PROXY', 'RATE_LIMIT_REGISTER_IP_MAX', 'RATE_LIMIT_FORGOT_IP_MAX', 'RATE_LIMIT_RESET_IP_MAX', 'RATE_LIMIT_RESEND_USER_MAX', 'RATE_LIMIT_LOGIN_FAIL_ACCOUNT_MAX', 'RATE_LIMIT_LOGIN_FAIL_IP_MAX'];

/** Ограничение частоты публичных маршрутов (#179): настоящее приложение, PostgreSQL, управляемое время. */
describe('rate limiting (real app, PostgreSQL counters)', () => {
  let ctx: Ctx;
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => { for (const k of ENV_KEYS) saved[k] = process.env[k]; });
  afterEach(async () => {
    await closeApp(ctx);
    for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
  });

  const boot = async (env: Record<string, string> = {}) => {
    Object.assign(process.env, env);
    ctx = await bootstrapApp();
    ctx.clock.setNow(new Date('2026-10-02T10:00:00.000Z'));
  };
  const post = async (path: string, body: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(`${ctx.baseUrl}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
    const text = await res.text();
    return { status: res.status, retryAfter: res.headers.get('retry-after'), body: text ? JSON.parse(text) : null };
  };
  const login = (email: string, password: string, ip?: string) => post('/auth/login', { email, password }, ip ? { 'x-forwarded-for': ip } : {});
  const makeUser = async (email: string, password = 'correct horse') =>
    ctx.factory.createUser({ email, passwordHash: await hashPassword(password) });

  describe('login', () => {
    it('five wrong passwords for one account from one IP lock that pair; Retry-After says when to retry; the window resets', async () => {
      await boot();
      await makeUser('victim@test.local');
      for (let i = 0; i < 5; i++) expect((await login('victim@test.local', 'wrong')).status).toBe(401);
      const locked = await login('victim@test.local', 'wrong');
      expect(locked.status).toBe(429);
      expect(locked.body).toEqual({ statusCode: 429, message: 'Too many requests' });
      expect(Number(locked.retryAfter)).toBeGreaterThan(0);
      expect(Number(locked.retryAfter)).toBeLessThanOrEqual(900);
      // и правильный пароль в блокировке не проходит: подбор не должен получать подсказку
      expect((await login('victim@test.local', 'correct horse')).status).toBe(429);

      ctx.clock.advance(901 * 1000);
      expect((await login('victim@test.local', 'correct horse')).status).toBe(201);
    });

    it('an unknown address behaves exactly like a known one (no account enumeration)', async () => {
      await boot();
      await makeUser('known@test.local');
      const seq = async (email: string) => {
        const out: number[] = [];
        for (let i = 0; i < 7; i++) out.push((await login(email, 'wrong')).status);
        return out;
      };
      const known = await seq('known@test.local');
      const unknown = await seq('nobody@test.local');
      expect(known).toEqual([401, 401, 401, 401, 401, 429, 429]);
      expect(unknown).toEqual(known);
    });

    it('a correct password clears the pair counter: typos do not accumulate', async () => {
      await boot();
      await makeUser('typo@test.local');
      for (let round = 0; round < 3; round++) {
        for (let i = 0; i < 4; i++) expect((await login('typo@test.local', 'wrong')).status).toBe(401);
        expect((await login('typo@test.local', 'correct horse')).status).toBe(201);
      }
    });

    it('another IP is not locked by someone else\'s failures (behind a trusted proxy)', async () => {
      await boot({ TRUST_PROXY: 'loopback' });
      await makeUser('owner@test.local');
      for (let i = 0; i < 6; i++) await login('owner@test.local', 'wrong', '203.0.113.7');
      expect((await login('owner@test.local', 'wrong', '203.0.113.7')).status).toBe(429);
      // законный пользователь с другого адреса входит
      expect((await login('owner@test.local', 'correct horse', '198.51.100.20')).status).toBe(201);
      // а злоумышленник не получает свежую попытку, меняя адрес на ту же учётную запись только вместе с IP-лимитом
      expect((await login('someone.else@test.local', 'x', '203.0.113.7')).status).toBe(401);
    });

    it('without a trusted proxy X-Forwarded-For is ignored, so it cannot be used to dodge the limit', async () => {
      await boot();
      await makeUser('spoof@test.local');
      for (let i = 0; i < 5; i++) await login('spoof@test.local', 'wrong', `203.0.113.${i}`);
      expect((await login('spoof@test.local', 'wrong', '198.51.100.99')).status).toBe(429);
    });

    it('the per-IP failure limit stops spraying many accounts from one address', async () => {
      await boot({ RATE_LIMIT_LOGIN_FAIL_IP_MAX: '6' });
      for (let i = 0; i < 6; i++) expect((await login(`spray${i}@test.local`, 'x')).status).toBe(401);
      expect((await login('spray-new@test.local', 'x')).status).toBe(429);
    });

    it('the per-account limit catches a distributed guess across many IPs', async () => {
      await boot({ TRUST_PROXY: 'loopback', RATE_LIMIT_LOGIN_FAIL_ACCOUNT_MAX: '8' });
      await makeUser('target@test.local');
      for (let i = 0; i < 8; i++) expect((await login('target@test.local', 'wrong', `203.0.113.${i + 1}`)).status).toBe(401);
      expect((await login('target@test.local', 'wrong', '203.0.113.200')).status).toBe(429);
    });
  });

  describe('registration, recovery and verification routes', () => {
    it('registration is limited per IP', async () => {
      await boot({ RATE_LIMIT_REGISTER_IP_MAX: '2' });
      const reg = (n: number) => post('/auth/register', { name: 'T', email: `reg${n}@test.local`, phone: '+70000000000', password: 'correct horse' });
      expect([(await reg(1)).status, (await reg(2)).status]).toEqual([201, 201]);
      const third = await reg(3);
      expect(third.status).toBe(429);
      expect(third.retryAfter).toBeTruthy();
      expect(await ctx.db.user.count({ where: { email: 'reg3@test.local' } })).toBe(0);
      ctx.clock.advance(3601 * 1000);
      expect((await reg(3)).status).toBe(201);
    });

    it('mail bursts to many addresses from one IP are stopped, and the answer does not depend on the address', async () => {
      await boot({ RATE_LIMIT_FORGOT_IP_MAX: '3' });
      await makeUser('real@test.local');
      const statuses: number[] = [];
      for (const email of ['real@test.local', 'a@test.local', 'b@test.local', 'c@test.local', 'real@test.local']) statuses.push((await post('/auth/forgot-password', { email })).status);
      expect(statuses).toEqual([201, 201, 201, 429, 429]);
    });

    it('token guessing on reset-password is limited per IP', async () => {
      await boot({ RATE_LIMIT_RESET_IP_MAX: '3' });
      const attempt = () => post('/auth/reset-password', { token: 'f'.repeat(64), password: 'new password 1' });
      expect([(await attempt()).status, (await attempt()).status, (await attempt()).status]).toEqual([401, 401, 401]);
      expect((await attempt()).status).toBe(429);
    });

    it('resend-verification is limited per signed-in user, not per IP', async () => {
      await boot({ RATE_LIMIT_RESEND_USER_MAX: '2' });
      const a = await ctx.db.user.create({ data: { email: 'unverified.a@test.local' } });
      const b = await ctx.db.user.create({ data: { email: 'unverified.b@test.local' } });
      const resend = (id: string) => ctx.request('POST', '/auth/resend-verification', undefined, id);
      expect([(await resend(a.id)).status, (await resend(a.id)).status]).toEqual([201, 201]);
      expect((await resend(a.id)).status).toBe(429);
      expect((await resend(b.id)).status).toBe(201); // чужие запросы не расходуют лимит
    });
  });

  describe('storage', () => {
    it('counters hold only hashes (no addresses or IPs) and the first excess of a window is audited once', async () => {
      await boot({ RATE_LIMIT_REGISTER_IP_MAX: '1' });
      const reg = (n: number) => post('/auth/register', { name: 'T', email: `leak${n}@test.local`, phone: '+70000000000', password: 'correct horse' });
      await reg(1);
      await reg(2);
      await reg(3);
      await reg(4);
      const rows = await ctx.db.rateLimitBucket.findMany();
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) expect(r.key).toMatch(/^[a-z_]+:[0-9a-f]{64}$/);
      expect(JSON.stringify(rows)).not.toMatch(/@|127\.0\.0\.1|::1/);
      const audited = await ctx.db.auditLog.findMany({ where: { action: 'rate_limited' } });
      expect(audited).toHaveLength(1);
      expect(audited[0]).toMatchObject({ actorType: 'System', targetId: 'register_ip' });
    });
  });
});
