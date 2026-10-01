/**
 * Форматы клиентского шифрования (ADR-0003). Сервер не расшифровывает ничего и не доверяет клиенту вслепую:
 * проверяет только форму и размер, чтобы в базу не попадали произвольные строки вместо конвертов и упаковок ключей.
 * Паттерны совпадают с тем, что выдаёт apps/web/src/lib/vault-crypto.ts (v1.<iv:12 байт>.<шифротекст+тег>, base64url без «=»).
 */

/** Упакованный 256-битный ключ: IV 12 байт (16 символов) + 32 байта ключа + 16 байт тега GCM = 48 байт (64 символа). */
export const KEY_ENVELOPE_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;

/**
 * Ключ сейфа настроен, только если mk_wrapped — валидный конверт v1. Любое другое значение (NULL или оставшаяся от прежнего
 * сервера случайная строка, например вставленная старым API между миграцией и заменой образа) считается «не настроен».
 */
export const hasVaultKey = (mkWrapped: string | null | undefined): mkWrapped is string =>
  typeof mkWrapped === 'string' && KEY_ENVELOPE_PATTERN.test(mkWrapped);

/** Шифротекст блока: тег GCM — не меньше 16 байт (22 символа); верхний предел задаёт MAX_CIPHERTEXT_LENGTH. */
export const CIPHERTEXT_ENVELOPE_PATTERN = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

/** Не больше лимита тела запроса по умолчанию (100 КБ, JSON_BODY_LIMIT): запас на остальные поля. */
export const MAX_CIPHERTEXT_LENGTH = 60_000;

/** RSA-OAEP 3072: шифротекст равен длине модуля — ровно 384 байта. */
export const RSA_3072_WRAP_BYTES = 384;

const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/** Упаковка DEK под ключ получателя: стандартный base64 ровно от 384 байт. */
export function isRsa3072Wrap(value: unknown): value is string {
  if (typeof value !== 'string' || !STANDARD_BASE64.test(value)) return false;
  const bytes = Buffer.from(value, 'base64');
  // повторное кодирование отсекает неканоничные хвосты
  return bytes.length === RSA_3072_WRAP_BYTES && bytes.toString('base64') === value;
}
