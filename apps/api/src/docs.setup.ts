import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Swagger UI и JSON-описание (`/docs`, `/docs-json`) регистрируются на уровне HTTP-адаптера, мимо guard'ов приложения, то есть
 * доступны без входа. Поэтому в production они выключены по умолчанию; включить явно — SWAGGER_ENABLED=true (например, на закрытом
 * стенде), выключить вне production — SWAGGER_ENABLED=false.
 */
export function docsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Подключает документацию, если она разрешена; возвращает, подключена ли. */
export function setupDocs(app: INestApplication, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!docsEnabled(env)) return false;
  const config = new DocumentBuilder()
    .setTitle('AfterLight API')
    .setDescription('MVP endpoints for vaults, verifiers, and verification events')
    .setVersion('0.2.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  return true;
}
