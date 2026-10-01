import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { RequestMethod } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { IS_PUBLIC_KEY } from '../../src/auth/decorators/public.decorator.js';
import { ROLES_KEY } from '../../src/auth/decorators/roles.decorator.js';
import { REQUIRE_VERIFIED_EMAIL_KEY } from '../../src/auth/decorators/require-verified-email.decorator.js';
import { RATE_LIMIT_KEY } from '../../src/rate-limit/rate-limit.decorator.js';
import { bootstrapApp, closeApp, Ctx } from './helper.js';

/**
 * «Все маршруты закрыты» (#164): тест сам перечисляет маршруты, зарегистрированные в Nest, и падает, если появился маршрут,
 * открытый без явной пометки @Public() и без записи в списке ниже, или если неанонимный маршрут отвечает анониму не 401.
 * Таблица «маршрут × роль» (docs/security/route-access.md) строится из тех же метаданных и сверяется с файлом.
 */

/** Единственные маршруты, доступные без входа. Новый публичный маршрут обязан появиться здесь — то есть пройти ревью. */
const PUBLIC_ALLOWLIST = new Set([
  'GET /healthz',
  'GET /readyz',
  'POST /auth/register',
  'POST /auth/login',
  'POST /auth/logout',
  'POST /auth/forgot-password',
  'POST /auth/reset-password',
  'POST /auth/verify-email',
  'POST /verifiers/invitations/preview',
]);

interface RouteInfo {
  key: string;
  method: string;
  path: string;
  isPublic: boolean;
  adminOnly: boolean;
  verifiedEmail: boolean;
  rateLimit: string | null;
}

const UUID = '11111111-1111-4111-8111-111111111111';

function discoverRoutes(ctx: Ctx): RouteInfo[] {
  const reflector = new Reflector();
  const modules = ctx.moduleRef.get(ModulesContainer);
  const routes = new Map<string, RouteInfo>();
  const norm = (p: string) => '/' + p.split('/').filter(Boolean).join('/');
  for (const module of modules.values()) {
    for (const wrapper of module.controllers.values()) {
      const type = wrapper.metatype as (new (...a: never[]) => unknown) | null;
      if (!type) continue;
      const prefixRaw = Reflect.getMetadata(PATH_METADATA, type);
      const prefix = Array.isArray(prefixRaw) ? prefixRaw[0] : prefixRaw ?? '';
      const proto = type.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (typeof handler !== 'function' || name === 'constructor') continue;
        const methodCode = Reflect.getMetadata(METHOD_METADATA, handler);
        if (methodCode === undefined) continue;
        const sub = Reflect.getMetadata(PATH_METADATA, handler);
        const path = norm(`${prefix}/${Array.isArray(sub) ? sub[0] : sub ?? ''}`);
        const method = RequestMethod[methodCode as number];
        const roles = reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [handler as never, type]) ?? [];
        const rl = reflector.getAllAndOverride<{ policy: string; by: string } | undefined>(RATE_LIMIT_KEY, [handler as never, type]);
        routes.set(`${method} ${path}`, {
          key: `${method} ${path}`,
          method,
          path,
          isPublic: !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler as never, type]),
          adminOnly: roles.includes('Admin'),
          verifiedEmail: !!reflector.getAllAndOverride<boolean>(REQUIRE_VERIFIED_EMAIL_KEY, [handler as never, type]),
          rateLimit: rl ? `${rl.policy} (${rl.by})` : null,
        });
      }
    }
  }
  return [...routes.values()].sort((a, b) => (a.path === b.path ? a.method.localeCompare(b.method) : a.path.localeCompare(b.path)));
}

/** Подставляет в параметры маршрута допустимые значения, чтобы запрос дошёл до проверки доступа, а не до валидации пути. */
const concrete = (path: string) => path.replace(/:[A-Za-z]+/g, UUID);

const TABLE_FILE = resolve(process.cwd(), '../../docs/security/route-access.md');

function renderTable(routes: RouteInfo[]): string {
  const rows = routes.map((r) => {
    const access = r.isPublic ? 'публичный' : r.adminOnly ? 'только администратор платформы' : 'вошедший пользователь; доступ к объекту (сейф, блок, событие) проверяется по сессии';
    const notes = [r.verifiedEmail ? 'нужен подтверждённый адрес' : '', r.rateLimit ? `лимит частоты: ${r.rateLimit}` : ''].filter(Boolean).join('; ') || '—';
    const anon = r.isPublic ? 'доходит до обработчика' : '401';
    const user = r.isPublic ? 'то же' : r.adminOnly ? '403' : 'по объекту: 403/404 для чужого';
    const admin = r.isPublic ? 'то же' : r.adminOnly ? 'допущен' : 'как обычный пользователь: глобальная роль доступа к сейфу не даёт';
    return `| \`${r.method} ${r.path}\` | ${access} | ${anon} | ${user} | ${admin} | ${notes} |`;
  });
  return [
    '# Доступ к маршрутам API: маршрут × роль',
    '',
    '> Файл **генерируется** тестом `apps/api/test/integration/route-access.spec.ts` из метаданных маршрутов Nest и сверяется им при каждом запуске CI.',
    '> Обновить после изменения маршрутов: `UPDATE_ROUTE_TABLE=1 npm run test:integration -- route-access` (затем просмотреть diff — каждое новое публичное или администраторское изменение проходит ревью).',
    '',
    'Правила: вход без токена даёт `401` на любом маршруте, кроме перечисленных как публичные; администраторские маршруты дают обычному пользователю `403` независимо от того, владеет ли он сейфом; роль платформы `Admin` сама по себе доступа к чужому сейфу не даёт (проверяется по сейфу через `VaultAccessService`).',
    '',
    '| Маршрут | Доступ | Аноним | Обычный пользователь | Администратор платформы | Особенности |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');
}

describe('route access table (every registered route, real guards)', () => {
  let ctx: Ctx;
  beforeEach(async () => { ctx = await bootstrapApp(); });
  afterEach(async () => { await closeApp(ctx); });

  it('finds the routes (guards against the discovery silently returning nothing)', () => {
    const routes = discoverRoutes(ctx);
    expect(routes.length).toBeGreaterThan(60);
    for (const key of ['GET /vaults', 'POST /auth/login', 'GET /users', 'POST /orchestration/start', 'GET /p/:token', 'PUT /recipients/me/key']) {
      expect(routes.map((r) => r.key)).toContain(key);
    }
  });

  it('only the explicit allowlist is public: a new route without authentication has to be added here on purpose', () => {
    const publicRoutes = discoverRoutes(ctx).filter((r) => r.isPublic).map((r) => r.key).sort();
    expect(publicRoutes).toEqual([...PUBLIC_ALLOWLIST].sort());
  });

  it('every non-public route answers 401 to an anonymous caller, for any method and well-formed parameters', async () => {
    const failures: string[] = [];
    for (const r of discoverRoutes(ctx).filter((x) => !x.isPublic)) {
      const res = await ctx.request(r.method, concrete(r.path), r.method === 'GET' || r.method === 'DELETE' ? undefined : {});
      if (res.status !== 401) failures.push(`${r.key} → ${res.status}`);
    }
    expect(failures).toEqual([]);
  });

  it('every admin-only route answers 403 to an ordinary signed-in user (owner of a vault included) and does not reject the platform admin by role', async () => {
    const owner = await ctx.factory.createUser({ email: 'owner@test.local' });
    await ctx.factory.createVault(owner.id);
    const admin = await ctx.factory.createUser({ email: 'admin@test.local', role: 'Admin' });
    const failures: string[] = [];
    for (const r of discoverRoutes(ctx).filter((x) => x.adminOnly)) {
      const body = r.method === 'GET' || r.method === 'DELETE' ? undefined : {};
      const asOwner = (await ctx.request(r.method, concrete(r.path), body, owner.id)).status;
      if (asOwner !== 403) failures.push(`${r.key} as owner → ${asOwner}`);
      const asAdmin = (await ctx.request(r.method, concrete(r.path), body, admin.id)).status;
      if (asAdmin === 401 || asAdmin === 403) failures.push(`${r.key} as admin → ${asAdmin}`);
    }
    expect(failures).toEqual([]);
  });

  it('the committed table docs/security/route-access.md matches the registered routes', () => {
    const table = renderTable(discoverRoutes(ctx));
    if (process.env.UPDATE_ROUTE_TABLE === '1') writeFileSync(TABLE_FILE, table);
    const committed = readFileSync(TABLE_FILE, 'utf8');
    expect(committed).toBe(table);
  });
});
