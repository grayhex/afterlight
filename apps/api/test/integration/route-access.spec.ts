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

/**
 * Вошедший пользователь, но доступ НЕ определяется объектом (сейфом, блоком, событием): данные выбираются по сессии
 * (собственная запись, собственные сейфы) или это справочник. Каждая такая запись объяснена; все остальные маршруты
 * с входом считаются объектными (доступ решает сервис по сейфу из сессии) и проверяются тестами object-authorization.
 */
const SESSION_SCOPED: Record<string, string> = {
  'GET /auth/me': 'собственная учётная запись',
  'POST /auth/resend-verification': 'собственная учётная запись',
  'PUT /recipients/me/key': 'собственные записи получателя: по подтверждённому адресу аккаунта',
  'GET /vaults': 'только собственные сейфы (выборка по сессии)',
  'POST /vaults': 'создаёт сейф для себя; нужен подтверждённый адрес',
};
const REFERENCE_DATA: Record<string, string> = {
  'GET /plans': 'справочник тарифов: доступен любому вошедшему',
  'GET /plans/:id': 'справочник тарифов: доступен любому вошедшему',
};

/** Доступ по секретному токену, а не по сейфу: вошедший пользователь, предъявивший верный токен, получает результат без проверки доступа к сейфу. */
const CAPABILITY: Record<string, string> = {
  'GET /p/:token': 'доступ по секретному токену ссылки без проверки сейфа; сейчас дополнительно требует входа, ответ — только метаданные блока (#171)',
  'POST /verifiers/invitations/accept': 'доступ по одноразовому токену приглашения: нужен подтверждённый адрес сессии, равный адресу приглашения; роль в сейфе выдаёт сам токен, а не проверка доступа к сейфу',
};

type Scope = 'public' | 'admin' | 'session' | 'reference' | 'capability' | 'object';

interface RouteInfo {
  key: string;
  method: string;
  path: string;
  isPublic: boolean;
  adminOnly: boolean;
  scope: Scope;
  scopeNote: string;
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
        const key = `${method} ${path}`;
        const isPublic = !!reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [handler as never, type]);
        const adminOnly = roles.includes('Admin');
        const scope: Scope = isPublic ? 'public' : adminOnly ? 'admin' : key in SESSION_SCOPED ? 'session' : key in REFERENCE_DATA ? 'reference' : key in CAPABILITY ? 'capability' : 'object';
        routes.set(key, {
          key,
          method,
          path,
          isPublic,
          adminOnly,
          scope,
          scopeNote: SESSION_SCOPED[key] ?? REFERENCE_DATA[key] ?? CAPABILITY[key] ?? '',
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

const ACCESS_TEXT: Record<Scope, [string, string, string, string]> = {
  // доступ, аноним, обычный пользователь, администратор платформы
  public: ['публичный', 'доходит до обработчика', 'то же', 'то же'],
  admin: ['только администратор платформы', '401', '403', 'допущен'],
  session: ['вошедший пользователь; данные выбираются по сессии', '401', 'допущен к своим данным', 'как обычный пользователь'],
  reference: ['вошедший пользователь; справочник без привязки к объекту', '401', 'допущен', 'допущен'],
  capability: ['вошедший пользователь, предъявивший верный секретный токен', '401', 'допущен при верном токене (и адресе, если токен выписан на адрес); иначе отказ', 'как обычный пользователь'],
  object: ['вошедший пользователь; доступ определяет объект (сейф, блок, событие) по сессии', '401', '403/404 для чужого объекта (проверяют тесты по модулям)', 'как обычный пользователь: глобальная роль доступа к сейфу не даёт'],
};

function renderTable(routes: RouteInfo[]): string {
  const rows = routes.map((r) => {
    const [access, anon, user, admin] = ACCESS_TEXT[r.scope];
    const notes = [r.scopeNote, r.verifiedEmail ? 'нужен подтверждённый адрес' : '', r.rateLimit ? `лимит частоты: ${r.rateLimit}` : ''].filter(Boolean).join('; ') || '—';
    return `| \`${r.method} ${r.path}\` | ${access} | ${anon} | ${user} | ${admin} | ${notes} |`;
  });
  return [
    '# Доступ к маршрутам API: маршрут × роль',
    '',
    '> Файл **генерируется** тестом `apps/api/test/integration/route-access.spec.ts` из метаданных маршрутов Nest и сверяется им при каждом запуске CI.',
    '> Обновить после изменения маршрутов: `UPDATE_ROUTE_TABLE=1 npm run test:integration -- route-access` (затем просмотреть diff — каждое новое публичное, администраторское или «без объекта» изменение проходит ревью).',
    '',
    'Виды доступа:',
    '- **публичный** — без входа (закрытый список `PUBLIC_ALLOWLIST` в тесте);',
    '- **только администратор платформы** — аноним `401`, обычный пользователь `403` независимо от владения сейфом;',
    '- **данные выбираются по сессии**, **справочник** и **секретная ссылка** — вход нужен, но доступ не зависит от объекта (решает токен, а не сейф: публичная ссылка, приглашение); каждый такой маршрут перечислен в тесте с причиной (`SESSION_SCOPED`, `REFERENCE_DATA`, `CAPABILITY`);',
    '- **объектный** — всё остальное: сервис проверяет доступ к конкретному сейфу, блоку или событию по сессии (`VaultAccessService` или проверка владения); глобальная роль `Admin` чужого сейфа не открывает. Это вид **по умолчанию**: новый маршрут попадает сюда, пока его не отнесли к другому виду явно, поэтому отрицательные сценарии по каждому модулю (`object-authorization.spec.ts`, `security.authorization.spec.ts`) обязательны для каждого нового объектного маршрута.',
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

  it('routes marked as not object-scoped really work for any signed-in user, and the markings stay in sync with the routes', async () => {
    const routes = discoverRoutes(ctx);
    const keys = new Set(routes.map((r) => r.key));
    for (const key of [...Object.keys(SESSION_SCOPED), ...Object.keys(REFERENCE_DATA), ...Object.keys(CAPABILITY)]) expect(keys.has(key)).toBe(true); // нет устаревших записей
    const person = await ctx.factory.createUser({ email: 'person@test.local' });
    const open = [['GET', '/auth/me'], ['GET', '/vaults'], ['GET', '/plans'], ['POST', '/vaults', { name: 'Mine' }], ['PUT', '/recipients/me/key', { pubkey: 'KEY' }]] as Array<[string, string, unknown?]>;
    for (const [method, path, body] of open) {
      const res = await ctx.request(method, path, body, person.id);
      expect([method, path, [200, 201].includes(res.status)]).toEqual([method, path, true]);
    }
  });

  it('the committed table docs/security/route-access.md matches the registered routes', () => {
    const table = renderTable(discoverRoutes(ctx));
    if (process.env.UPDATE_ROUTE_TABLE === '1') writeFileSync(TABLE_FILE, table);
    const committed = readFileSync(TABLE_FILE, 'utf8');
    expect(committed).toBe(table);
  });
});
