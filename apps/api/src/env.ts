import { mailConfigProblems } from './notifications/mail.config.js';

/** Проверка окружения при старте API. Вынесена из main.ts, чтобы её можно было тестировать. */
export function missingEnvVars(env: NodeJS.ProcessEnv): string[] {
  const required = ['JWT_SECRET', 'DATABASE_URL', 'CORS_ALLOWED_ORIGINS'];
  // В production ссылки в письмах (приглашения) обязаны вести на реальный адрес веба, а не на localhost
  if (env.NODE_ENV === 'production') required.push('WEB_BASE_URL');
  return required.filter((name) => !env[name]?.trim());
}

export function validateEnv(env: NodeJS.ProcessEnv = process.env): void {
  const missing = missingEnvVars(env);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  const mail = mailConfigProblems(env);
  if (mail.length > 0) {
    throw new Error(`Invalid mail configuration: ${mail.join('; ')}`);
  }
}
