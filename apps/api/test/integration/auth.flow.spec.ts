import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { execFileSync } from 'child_process';
import { bootstrapApp, closeApp, Ctx } from './helper.js';
import { trustedOrigins } from '../../src/common/origin-check.middleware.js';

describe('auth flow (real guard, cookie session, seeded admin)', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  const call = async (path: string, init: RequestInit = {}) => {
    const addr = (ctx.app.getHttpServer().address() as any).port;
    return fetch(`http://127.0.0.1:${addr}${path}`, init);
  };

  it('register -> login sets an httpOnly cookie that authenticates /auth/me', async () => {
    const reg = await call('/auth/register', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Test', email: 'flow@test.local', phone: '+70000000000', password: 'correct horse' }),
    });
    expect(reg.status).toBe(201);
    const login = await call('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'flow@test.local', password: 'correct horse' }),
    });
    expect(login.status).toBe(201);
    const cookie = login.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/^token=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(JSON.stringify(await login.json())).not.toMatch(/password|hash/i);

    const me = await call('/auth/me', { headers: { cookie: cookie.split(';')[0] } });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual(expect.objectContaining({ email: 'flow@test.local' }));

    const bad = await call('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'flow@test.local', password: 'wrong' }),
    });
    expect(bad.status).toBe(401);
  });

  it('the seeded admin can log in with the documented password and reaches admin-only routes', async () => {
    execFileSync('npx', ['tsx', 'prisma/seed.ts'], {
      env: { ...process.env, ADMIN_PASSWORD: 'seed-admin-password' },
      stdio: 'pipe',
    });
    const login = await call('/auth/login', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'seed-admin-password' }),
    });
    expect(login.status).toBe(201);
    const cookie = (login.headers.get('set-cookie') ?? '').split(';')[0];
    const users = await call('/users', { headers: { cookie } });
    expect(users.status).toBe(200);
  });

  describe('origin check for state-changing requests (CSRF on top of SameSite=Lax)', () => {
    const post = (origin?: string) =>
      call('/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) },
        body: JSON.stringify({ email: 'nobody@test.local', password: 'x' }),
      });

    // доверенный адрес берётся из окружения: в CI он http://localhost:3001, локально — http://localhost
    const trusted = trustedOrigins()[0];

    it('rejects a foreign or null Origin, allows a trusted one and requests without Origin', async () => {
      expect((await post('https://evil.example')).status).toBe(403);
      expect((await post('null')).status).toBe(403);
      expect((await post(trusted)).status).toBe(401); // доверенный origin доходит до проверки пароля
      expect((await post(`${trusted}/`)).status).toBe(401);
      expect((await post()).status).toBe(401); // не браузерный клиент
    });

    it('does not touch safe methods', async () => {
      expect((await call('/healthz', { headers: { origin: 'https://evil.example' } })).status).toBe(200);
    });
  });
});
