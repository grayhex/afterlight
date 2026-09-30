import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json } from 'express';

/** Общая настройка приложения: одна и та же в runtime (main.ts) и в integration-тестах. */
export function configureApp(app: INestApplication) {
  app.use(helmet());
  app.use(json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidUnknownValues: false,
  }));
}
