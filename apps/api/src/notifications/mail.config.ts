/**
 * Настройки почтового транспорта и очереди из окружения.
 * В production обязательны MAIL_FROM и MAIL_SMTP_HOST без демонстрационных доменов; вне production есть умолчания для
 * локального почтового sandbox (Mailpit на 127.0.0.1:1025). Недоступная почта не превращается в «успех»:
 * письма остаются в очереди, а ошибка видна в notification.last_error.
 */
export type TlsMode = 'required' | 'opportunistic' | 'none';

export interface MailConfig {
  host: string;
  port: number;
  /** true — TLS с первого байта (порт 465); иначе STARTTLS по `tls` */
  secure: boolean;
  tls: TlsMode;
  user?: string;
  pass?: string;
  from: string;
  sendTimeoutMs: number;
  maxAttempts: number;
  retryBaseSeconds: number;
  retryMaxSeconds: number;
  dispatchIntervalMs: number;
}

const FORBIDDEN_RUNTIME_DOMAINS = /(^|\.)(example\.(com|org|net)|localhost|invalid|test)$/i;

function int(env: NodeJS.ProcessEnv, name: string, def: number): number {
  const raw = env[name]?.trim();
  if (!raw) return def;
  const n = Number(raw);
  return Number.isInteger(n) ? n : NaN;
}

function addressDomain(from: string): string {
  const m = from.match(/<([^<>]+)>\s*$/);
  const addr = (m ? m[1] : from).trim();
  return addr.includes('@') ? addr.slice(addr.lastIndexOf('@') + 1) : '';
}

/** Список проблем в настройках почты (пустой — всё в порядке). Только имена и причины, без значений секретов. */
export function mailConfigProblems(env: NodeJS.ProcessEnv): string[] {
  const problems: string[] = [];
  const production = env.NODE_ENV === 'production';
  const need = (name: string) => {
    if (!env[name]?.trim()) problems.push(`${name} is required in production`);
  };
  if (production) {
    need('MAIL_FROM');
    need('MAIL_SMTP_HOST');
  }
  const from = env.MAIL_FROM?.trim();
  if (from) {
    const domain = addressDomain(from);
    if (!domain) problems.push('MAIL_FROM must contain an email address');
    else if (production && FORBIDDEN_RUNTIME_DOMAINS.test(domain)) {
      problems.push('MAIL_FROM must use a real domain in production (not example.*/localhost/test)');
    }
  }
  const host = env.MAIL_SMTP_HOST?.trim();
  if (production && host && FORBIDDEN_RUNTIME_DOMAINS.test(host)) {
    problems.push('MAIL_SMTP_HOST must be a real host in production (not example.*/localhost/test)');
  }
  const tls = env.MAIL_SMTP_TLS?.trim();
  if (tls && !['required', 'opportunistic', 'none'].includes(tls)) {
    problems.push('MAIL_SMTP_TLS must be one of: required, opportunistic, none');
  }
  if (Boolean(env.MAIL_SMTP_USER?.trim()) !== Boolean(env.MAIL_SMTP_PASSWORD)) {
    problems.push('MAIL_SMTP_USER and MAIL_SMTP_PASSWORD must be set together');
  }
  for (const [name, min] of [
    ['MAIL_SMTP_PORT', 1], ['MAIL_SEND_TIMEOUT_MS', 1000], ['MAIL_MAX_ATTEMPTS', 1],
    ['MAIL_RETRY_BASE_SECONDS', 1], ['MAIL_RETRY_MAX_SECONDS', 1], ['MAIL_DISPATCH_INTERVAL_MS', 0],
  ] as const) {
    const v = int(env, name, min);
    if (!Number.isInteger(v) || v < min) problems.push(`${name} must be an integer >= ${min}`);
  }
  return problems;
}

export function loadMailConfig(env: NodeJS.ProcessEnv = process.env): MailConfig {
  const problems = mailConfigProblems(env);
  if (problems.length > 0) throw new Error(`Invalid mail configuration: ${problems.join('; ')}`);
  const production = env.NODE_ENV === 'production';
  const secure = env.MAIL_SMTP_SECURE?.trim() === 'true';
  return {
    host: env.MAIL_SMTP_HOST?.trim() || '127.0.0.1',
    port: int(env, 'MAIL_SMTP_PORT', secure ? 465 : production ? 587 : 1025),
    secure,
    tls: (env.MAIL_SMTP_TLS?.trim() as TlsMode | undefined) ?? (production ? 'required' : 'none'),
    user: env.MAIL_SMTP_USER?.trim() || undefined,
    pass: env.MAIL_SMTP_PASSWORD || undefined,
    from: env.MAIL_FROM?.trim() || 'AfterLight <no-reply@afterlight.localhost>',
    sendTimeoutMs: int(env, 'MAIL_SEND_TIMEOUT_MS', 15_000),
    maxAttempts: int(env, 'MAIL_MAX_ATTEMPTS', 12),
    retryBaseSeconds: int(env, 'MAIL_RETRY_BASE_SECONDS', 30),
    retryMaxSeconds: int(env, 'MAIL_RETRY_MAX_SECONDS', 3600),
    dispatchIntervalMs: int(env, 'MAIL_DISPATCH_INTERVAL_MS', 15_000),
  };
}
