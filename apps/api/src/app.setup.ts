import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import express from 'express';
import { PrismaExceptionFilter } from './common/prisma-exception.filter.js';

/** Общая настройка приложения: одна и та же в runtime (main.ts) и в integration-тестах. */
/** TRUST_PROXY: каким прокси доверять заголовок X-Forwarded-For (иначе IP клиента — адрес соседнего контейнера). Значения: true/false, число прыжков или список подсетей Express (например `uniquelocal`). */
export function trustProxySetting(raw: string | undefined): boolean | number | string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export function configureApp(app: INestApplication) {
  const trust = trustProxySetting(process.env.TRUST_PROXY);
  if (trust !== undefined) (app.getHttpAdapter().getInstance() as express.Express).set('trust proxy', trust);
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.use(helmet());
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidUnknownValues: false,
  }));
}
