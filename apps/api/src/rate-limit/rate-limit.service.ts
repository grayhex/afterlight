import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ActorType } from '@prisma/client';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { ClockService } from '../clock/clock.service.js';
import { AuditService } from '../audit/audit.service.js';

export interface Policy {
  max: number;
  windowSec: number;
}

/**
 * Лимиты по умолчанию; переопределяются через env: RATE_LIMIT_<ИМЯ>_MAX и RATE_LIMIT_<ИМЯ>_WINDOW_SEC (имя в верхнем регистре).
 * Окна фиксированные: на границе окна возможен всплеск до двойного лимита — осознанное упрощение.
 */
export const POLICIES = {
  // вход считает только неудачные попытки: правильный пароль лимит не расходует
  login_fail_ip: { max: 30, windowSec: 900 },
  login_fail_account_ip: { max: 5, windowSec: 900 },
  login_fail_account: { max: 50, windowSec: 3600 },
  register_ip: { max: 10, windowSec: 3600 },
  forgot_ip: { max: 10, windowSec: 3600 },
  reset_ip: { max: 20, windowSec: 3600 },
  verify_ip: { max: 30, windowSec: 3600 },
  resend_user: { max: 10, windowSec: 3600 },
  invitation_preview_ip: { max: 60, windowSec: 3600 },
  invitation_accept_user: { max: 20, windowSec: 3600 },
} as const satisfies Record<string, Policy>;

export type PolicyName = keyof typeof POLICIES;

export interface Reservation {
  name: PolicyName;
  subject: string;
  windowStart: Date;
}

export interface HitResult {
  allowed: boolean;
  count: number;
  retryAfterSec: number;
  /** Окно, в котором учтено обращение: нужно, чтобы вернуть резерв именно в него (release). */
  windowStart: Date;
}

export function policyOf(name: PolicyName, env: NodeJS.ProcessEnv = process.env): Policy {
  const base = POLICIES[name];
  const key = `RATE_LIMIT_${name.toUpperCase()}`;
  const read = (suffix: string, fallback: number) => {
    const raw = env[`${key}_${suffix}`];
    const n = raw === undefined || raw.trim() === '' ? NaN : Number(raw);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  };
  return { max: read('MAX', base.max), windowSec: read('WINDOW_SEC', base.windowSec) };
}

/** 429 с Retry-After. Тело одинаково для любого субъекта: существование адреса не раскрывается. */
export class TooManyRequestsException extends HttpException {
  constructor(readonly retryAfterSec: number) {
    super({ statusCode: HttpStatus.TOO_MANY_REQUESTS, message: 'Too many requests' }, HttpStatus.TOO_MANY_REQUESTS);
  }
}

/**
 * Ограничение частоты на счётчиках в PostgreSQL (D9: единственное хранилище, без Redis): атомарный UPSERT работает
 * корректно при нескольких экземплярах API. Субъект (IP, адрес) хранится только в виде SHA-256.
 */
@Injectable()
export class RateLimitService {
  constructor(private prisma: PrismaService, private clock: ClockService, private audit: AuditService) {}

  private window(policy: Policy) {
    const ms = policy.windowSec * 1000;
    const now = this.clock.now().getTime();
    const start = Math.floor(now / ms) * ms;
    return { start: new Date(start), retryAfterSec: Math.max(1, Math.ceil((start + ms - now) / 1000)) };
  }

  private bucketKey(name: PolicyName, subject: string): string {
    return `${name}:${createHash('sha256').update(subject).digest('hex')}`;
  }

  /**
   * Учитывает обращение и сообщает, укладывается ли оно в лимит. Счётчик растёт и при отказе (для простых маршрутов это
   * нормально: он считает обращения). `audit: false` — когда отказ обрабатывает вызывающий (см. reserve).
   */
  async hit(name: PolicyName, subject: string, audit = true): Promise<HitResult> {
    const policy = policyOf(name);
    const { start, retryAfterSec } = this.window(policy);
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_bucket ("key", window_start, "count") VALUES (${this.bucketKey(name, subject)}, ${start}, 1)
      ON CONFLICT ("key", window_start) DO UPDATE SET "count" = rate_limit_bucket."count" + 1
      RETURNING "count"`;
    const count = Number(rows[0].count);
    // в журнал — только первое превышение окна: поток запросов не должен превращаться в поток записей аудита
    if (audit && count === policy.max + 1) await this.audit.log(ActorType.System, 'rate-limit', 'rate_limited', 'RateLimit', name).catch(() => undefined);
    void this.maybeCleanup();
    return { allowed: count <= policy.max, count, retryAfterSec, windowStart: start };
  }

  /**
   * Допуск нескольких лимитов одной попытки с резервом: либо все счётчики приняли обращение (оно остаётся учтённым,
   * пока вызывающий не вернёт его `releaseAll`), либо отказал хотя бы один, и тогда откатываются ВСЕ резервы этой попытки,
   * включая отказавшие. Иначе параллельная пачка попыток навсегда раздувала бы общие счётчики сверх числа реально
   * допущенных и блокировала бы чужих пользователей (по IP или по аккаунту). В журнал аудита — первый отказ окна по
   * политике, а не каждая отклонённая попытка.
   */
  async reserve(entries: Array<[PolicyName, string]>): Promise<{ allowed: boolean; retryAfterSec: number; reservations: Reservation[] }> {
    const reservations: Reservation[] = [];
    const rejected: Reservation[] = [];
    let retryAfterSec = 0;
    for (const [name, subject] of entries) {
      const r = await this.hit(name, subject, false);
      const reservation = { name, subject, windowStart: r.windowStart };
      reservations.push(reservation);
      if (!r.allowed) {
        rejected.push(reservation);
        retryAfterSec = r.retryAfterSec;
        // порядок записей — от общего к частному (IP, пара, аккаунт): после первого отказа остальные счётчики не трогаем,
        // иначе заблокированный клиент с новым адресом в каждом запросе плодил бы строки счётчиков
        break;
      }
    }
    if (rejected.length === 0) return { allowed: true, retryAfterSec: 0, reservations };
    await this.releaseAll(reservations);
    for (const r of rejected) await this.auditFirstRejection(r);
    return { allowed: false, retryAfterSec, reservations: [] };
  }

  /** Возвращает резервы попытки (успешный вход или отказ). */
  async releaseAll(reservations: Reservation[]): Promise<void> {
    await Promise.all(reservations.map((r) => this.release(r.name, r.subject, r.windowStart)));
  }

  /** Первый отказ окна по политике и субъекту: отметка в той же таблице счётчиков, аудит — только если отметка новая. */
  private async auditFirstRejection(r: Reservation): Promise<void> {
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limit_bucket ("key", window_start, "count") VALUES (${`audit:${this.bucketKey(r.name, r.subject)}`}, ${r.windowStart}, 1)
      ON CONFLICT ("key", window_start) DO UPDATE SET "count" = rate_limit_bucket."count" + 1
      RETURNING "count"`;
    if (Number(rows[0].count) === 1) await this.audit.log(ActorType.System, 'rate-limit', 'rate_limited', 'RateLimit', r.name).catch(() => undefined);
  }

  /** Текущее значение без учёта нового обращения (только для справки и тестов: для допуска используйте `hit`, он атомарен). */
  async exceeded(name: PolicyName, subject: string): Promise<HitResult> {
    const policy = policyOf(name);
    const { start, retryAfterSec } = this.window(policy);
    const rows = await this.prisma.$queryRaw<Array<{ count: number }>>`
      SELECT "count" FROM rate_limit_bucket WHERE "key" = ${this.bucketKey(name, subject)} AND window_start = ${start}`;
    const count = rows.length ? Number(rows[0].count) : 0;
    return { allowed: count < policy.max, count, retryAfterSec, windowStart: start };
  }

  /**
   * Возвращает один резерв, сделанный `hit` (успешный вход не должен расходовать лимит неудач). Счётчик не уходит ниже
   * нуля, а опустевшая строка удаляется: откаты не должны оставлять мусор в таблице.
   */
  async release(name: PolicyName, subject: string, windowStart: Date): Promise<void> {
    const key = this.bucketKey(name, subject);
    const removed = await this.prisma.$executeRaw`DELETE FROM rate_limit_bucket WHERE "key" = ${key} AND window_start = ${windowStart} AND "count" <= 1`;
    if (removed === 0) {
      await this.prisma.$executeRaw`UPDATE rate_limit_bucket SET "count" = GREATEST("count" - 1, 0) WHERE "key" = ${key} AND window_start = ${windowStart}`;
    }
  }

  /** Сбрасывает счётчик субъекта (успешный вход снимает счётчик неудач для пары «аккаунт + IP»). */
  async reset(name: PolicyName, subject: string): Promise<void> {
    await this.prisma.rateLimitBucket.deleteMany({ where: { key: this.bucketKey(name, subject) } });
  }

  /** Устаревшие окна удаляются попутно (примерно раз на сотню обращений), без отдельных таймеров. */
  private async maybeCleanup(): Promise<void> {
    if (Math.random() >= 0.01) return;
    const longest = Math.max(...(Object.keys(POLICIES) as PolicyName[]).map((n) => policyOf(n).windowSec));
    const cutoff = new Date(this.clock.now().getTime() - 2 * longest * 1000);
    await this.prisma.rateLimitBucket.deleteMany({ where: { windowStart: { lt: cutoff } } }).catch(() => undefined);
  }
}

/** Единый субъект «клиент»: IP из запроса (за доверенным прокси — из X-Forwarded-For, см. TRUST_PROXY). */
export const clientIp = (req: { ip?: string }): string => (req.ip ?? 'unknown').replace(/^::ffff:/, '');
