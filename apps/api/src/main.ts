import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { setupDocs } from './docs.setup.js';
import { PrismaService } from './prisma/prisma.service.js';
import { configureApp } from './app.setup.js';
import { validateEnv } from './env.js';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  configureApp(app);

  setupDocs(app);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
