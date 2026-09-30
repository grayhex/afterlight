import { defineConfig, env } from 'prisma/config';

// Prisma 7: адрес БД для Migrate задаётся здесь, а не в schema.prisma; для клиента — через driver adapter.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'node dist/prisma/seed.js',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
