import { PrismaPg } from '@prisma/adapter-pg';

/**
 * Prisma 7 подключается к БД через driver adapter. Параметр `?schema=` из DATABASE_URL
 * (формат Prisma) переносится в опцию адаптера: сам драйвер pg его не понимает.
 */
export function prismaClientOptions(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const url = new URL(databaseUrl);
  const schema = url.searchParams.get('schema') ?? undefined;
  url.searchParams.delete('schema');
  return { adapter: new PrismaPg({ connectionString: url.toString() }, schema ? { schema } : undefined) };
}
