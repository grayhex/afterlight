import { createPublicKey } from 'crypto';

/** Формат ключа получателя фиксирован в ADR-0003: RSA-OAEP, модуль 3072 бита, открытая экспонента 65537. */
export const RECIPIENT_KEY_MODULUS_BITS = 3072;
export const RECIPIENT_KEY_PUBLIC_EXPONENT = 65537n;

const STANDARD_BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Открытый ключ получателя — SPKI в стандартном base64 ровно так, как его экспортирует браузер
 * (`apps/web/src/lib/vault-crypto.ts`). Проверяется структура и параметры, а не принадлежность ключа человеку:
 * слабый или чужого типа ключ владелец потом не смог бы использовать, а упаковка под него защищала бы хуже заявленного.
 */
export function isRecipientPublicKey(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || !STANDARD_BASE64.test(value)) return false;
  const der = Buffer.from(value, 'base64');
  if (der.toString('base64') !== value) return false; // неканоничный base64
  try {
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
    if (key.asymmetricKeyType !== 'rsa') return false; // не rsa-pss, не EC и не Ed25519
    const details = key.asymmetricKeyDetails;
    if (details?.modulusLength !== RECIPIENT_KEY_MODULUS_BITS || details.publicExponent !== RECIPIENT_KEY_PUBLIC_EXPONENT) return false;
    // повторный экспорт отсекает хвостовой мусор и нестандартное DER-кодирование: храним ровно то, что разобрали
    return Buffer.compare(key.export({ format: 'der', type: 'spki' }), der) === 0;
  } catch {
    return false;
  }
}
