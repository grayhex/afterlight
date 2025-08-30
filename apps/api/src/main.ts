import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { AuthGuard } from './auth/guards/auth.guard';
import helmet from 'helmet';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const corsOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  app.use(helmet());
  app.use(json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidUnknownValues: false,
  }));

  app.useGlobalGuards(app.get(AuthGuard));

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
