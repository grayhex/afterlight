import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service.js';
import { configureApp } from './app.setup.js';

type RequiredEnvVar = 'JWT_SECRET' | 'DATABASE_URL' | 'CORS_ALLOWED_ORIGINS';

function validateEnv(): void {
  const requiredEnvVars: RequiredEnvVar[] = [
    'JWT_SECRET',
    'DATABASE_URL',
    'CORS_ALLOWED_ORIGINS',
  ];

  const missingEnvVars = requiredEnvVars.filter((envVar) => {
    const value = process.env[envVar];
    return !value || !value.trim();
  });

  if (missingEnvVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingEnvVars.join(', ')}`,
    );
  }
}

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

  const config = new DocumentBuilder()
    .setTitle('AfterLight API')
    .setDescription('MVP endpoints for vaults, verifiers, and verification events')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
