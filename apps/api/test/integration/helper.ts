import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { AuthService } from '../../src/auth/auth.service.js';
import { PrismaService } from '../../src/prisma/prisma.service.js';

/**
 * Integration-контур: настоящее приложение (AppModule, те же guard'ы и pipes, что в runtime),
 * настоящий PostgreSQL, настоящие JWT. Подменять нечего: почта пока пишется в таблицу notification.
 */
function assertSafeDatabase() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required for integration tests (migrated PostgreSQL)');
  const name = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/test/i.test(name)) {
    throw new Error(`Refusing to run integration tests: database "${name}" does not look like a test database (name must contain "test")`);
  }
}

export type Ctx = Awaited<ReturnType<typeof bootstrapApp>>;

export async function bootstrapApp() {
  assertSafeDatabase();
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
  process.env.CORS_ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS || 'http://localhost';

  const moduleRef: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app: INestApplication = moduleRef.createNestApplication();
  configureApp(app);
  await app.listen(0);
  const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as any).port}`;

  const db = moduleRef.get(PrismaService);
  const auth = moduleRef.get(AuthService);

  // чистая БД для каждого теста (миграции остаются)
  const tables = await db.$queryRaw<Array<{ tablename: string }>>(
    Prisma.sql`SELECT tablename FROM pg_tables WHERE schemaname = current_schema() AND tablename <> '_prisma_migrations'`,
  );
  if (tables.length) {
    const list = tables.map((t) => `"${t.tablename}"`).join(', ');
    await db.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }

  /** userId → запрос с настоящим JWT этого пользователя; без userId — аноним; rawToken — произвольный bearer. */
  const request = async (method: string, path: string, body?: unknown, userId?: string, rawToken?: string) => {
    const token = rawToken ?? (userId ? auth.sign(userId) : undefined);
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };

  let seq = 0;
  const factory = {
    createUser: (attrs: Partial<Prisma.UserUncheckedCreateInput> = {}) =>
      db.user.create({ data: { email: `user${++seq}@test.local`, ...attrs } }),
    createVault: (userId: string, attrs: Partial<Prisma.VaultUncheckedCreateInput> = {}) =>
      db.vault.create({ data: { userId, name: 'Vault', mkWrapped: 'mk', ...attrs } }),
    createVerifier: async (vaultId: string, attrs: { status?: 'Invited' | 'Active' | 'Revoked'; email?: string } = {}) => {
      const user = await db.user.create({
        data: { email: attrs.email ?? `verifier${++seq}@test.local`, role: 'Verifier' },
      });
      const role = await db.vaultUserRole.create({
        data: { vaultId, userId: user.id, role: 'Verifier', status: attrs.status ?? 'Active', isPrimary: false },
      });
      return { user, role };
    },
  };

  /** Одноразовый токен приглашения так, как его получает адресат: из ссылки в письме (notification.payload). */
  const invitationTokens = async (email: string): Promise<string[]> => {
    const rows = await db.notification.findMany({ where: { toContact: email }, orderBy: { createdAt: 'asc' } });
    return rows
      .map((r) => String((r.payload as any)?.text ?? '').match(/#token=([A-Za-z0-9_-]+)/)?.[1])
      .filter((t): t is string => !!t);
  };

  return { app, moduleRef, db, request, factory, invitationTokens };
}

export async function closeApp(ctx?: Ctx) {
  if (ctx) await ctx.app.close();
}

export const HOUR = 3600 * 1000;
export const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR);
