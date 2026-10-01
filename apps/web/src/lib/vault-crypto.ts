/**
 * Клиентское шифрование содержимого сейфа (ADR-0003). Только стандартный WebCrypto, без собственных алгоритмов.
 * Выполняется в браузере: открытый текст и ключи на сервер не передаются.
 */

const subtle = () => globalThis.crypto.subtle;
const enc = new TextEncoder();
const dec = new TextDecoder();

export const ENVELOPE_VERSION = 'v1';
const IV_BYTES = 12;

export class CryptoFormatError extends Error {}
/** Неверный ключ, неверный контекст или повреждённые данные (для GCM это неразличимо и так задумано). */
export class CryptoDecryptError extends Error {}

type Bytes = Uint8Array<ArrayBuffer>;

// ---------- base64 ----------
const toB64 = (bytes: Uint8Array): string => {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
};
const fromB64 = (b64: string): Bytes => {
  try {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    throw new CryptoFormatError('Invalid base64');
  }
};
const toB64Url = (bytes: Uint8Array): string => toB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string): Bytes => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
const random = (n: number): Bytes => globalThis.crypto.getRandomValues(new Uint8Array(n));

/** Контекст (AAD): шифротекст нельзя перенести в другой сейф, блок или назначение. */
export const contextOf = (kind: 'block' | 'dek' | 'mk', vaultId: string, blockId = '-'): Bytes =>
  enc.encode(`afterlight/v1/${kind}/${vaultId}/${blockId}`);

// ---------- AES-256-GCM конверт v1: "v1.<iv>.<ct>" ----------
export async function generateKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

const AES_KEY_BYTES = 32;

function assertAes256(key: CryptoKey): void {
  const a = key.algorithm as Partial<AesKeyAlgorithm>;
  if (a.name !== 'AES-GCM' || a.length !== 256) throw new CryptoFormatError('Key must be AES-256-GCM');
}

/** Все пути упаковки ключа идут через экспорт: AES-128/192 отклоняем здесь, пока не получился файл, который не восстановить. */
export async function exportRawKey(key: CryptoKey): Promise<Bytes> {
  assertAes256(key);
  return new Uint8Array(await subtle().exportKey('raw', key));
}

/** `length: 256` не ограничивает импорт сырого ключа: 16 или 24 байта дали бы AES-128/192, поэтому длину проверяем сами. */
export async function importRawKey(raw: Uint8Array): Promise<CryptoKey> {
  if (raw.byteLength !== AES_KEY_BYTES) throw new CryptoFormatError('Key must be 32 bytes (AES-256)');
  return subtle().importKey('raw', raw as Bytes, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, plaintext: Uint8Array, context: Uint8Array): Promise<string> {
  assertAes256(key);
  const iv = random(IV_BYTES);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: context as Bytes }, key, plaintext as Bytes));
  return `${ENVELOPE_VERSION}.${toB64Url(iv)}.${toB64Url(ct)}`;
}

export async function open(key: CryptoKey, envelope: string, context: Uint8Array): Promise<Bytes> {
  assertAes256(key);
  const parts = envelope.split('.');
  if (parts.length !== 3 || parts[0] !== ENVELOPE_VERSION) throw new CryptoFormatError('Unsupported envelope');
  const iv = fromB64Url(parts[1]);
  if (iv.length !== IV_BYTES) throw new CryptoFormatError('Invalid IV');
  try {
    return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv, additionalData: context as Bytes }, key, fromB64Url(parts[2])));
  } catch {
    throw new CryptoDecryptError('Decryption failed');
  }
}

// ---------- блок ----------
export const encryptText = (dek: CryptoKey, text: string, vaultId: string, blockId: string) =>
  seal(dek, enc.encode(text), contextOf('block', vaultId, blockId));
export const decryptText = async (dek: CryptoKey, envelope: string, vaultId: string, blockId: string) =>
  dec.decode(await open(dek, envelope, contextOf('block', vaultId, blockId)));

// ---------- DEK под ключом сейфа (владелец) ----------
export const wrapDekForOwner = async (mk: CryptoKey, dek: CryptoKey, vaultId: string, blockId: string) =>
  seal(mk, await exportRawKey(dek), contextOf('dek', vaultId, blockId));
export const unwrapDekForOwner = async (mk: CryptoKey, envelope: string, vaultId: string, blockId: string) =>
  importRawKey(await open(mk, envelope, contextOf('dek', vaultId, blockId)));

// ---------- recovery-код владельца и ключ сейфа MK ----------
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
/** 256 бит случайности, показывается один раз: XXXXX-XXXXX-... (52 символа base32, группы по 5). */
export function generateRecoveryCode(): string {
  const bytes = random(32);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out.match(/.{1,5}/g)!.join('-');
}

function recoveryBytes(code: string): Bytes {
  const clean = code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== 52 || [...clean].some((c) => !ALPHABET.includes(c))) throw new CryptoFormatError('Invalid recovery code');
  const out = new Uint8Array(32);
  let bits = 0;
  let value = 0;
  let idx = 0;
  for (const c of clean) {
    value = (value << 5) | ALPHABET.indexOf(c);
    bits += 5;
    if (bits >= 8) {
      out[idx++] = (value >>> (bits - 8)) & 255;
      bits -= 8;
      if (idx === 32) break;
    }
  }
  return out;
}

async function recoveryKek(code: string, vaultId: string): Promise<CryptoKey> {
  // код — 256 бит случайности, растягивать пароль не нужно: достаточно HKDF с привязкой к сейфу
  const ikm = await subtle().importKey('raw', recoveryBytes(code), 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: enc.encode(vaultId), info: enc.encode('afterlight/mk-wrap/v1') },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function wrapVaultKey(mk: CryptoKey, recoveryCode: string, vaultId: string): Promise<string> {
  return seal(await recoveryKek(recoveryCode, vaultId), await exportRawKey(mk), contextOf('mk', vaultId));
}
export async function unwrapVaultKey(mkWrapped: string, recoveryCode: string, vaultId: string): Promise<CryptoKey> {
  return importRawKey(await open(await recoveryKek(recoveryCode, vaultId), mkWrapped, contextOf('mk', vaultId)));
}

// ---------- ключ получателя (RSA-OAEP 3072, SHA-256) ----------
export async function generateRecipientKeyPair(): Promise<CryptoKeyPair> {
  return subtle().generateKey(
    { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['encrypt', 'decrypt'],
  ) as Promise<CryptoKeyPair>;
}

/** Открытый ключ как строка (SPKI base64): то, что получатель заявляет серверу. */
export const exportPublicKey = async (key: CryptoKey): Promise<string> => toB64(new Uint8Array(await subtle().exportKey('spki', key)));

const RSA_MODULUS_BITS = 3072;
const RSA_PUBLIC_EXPONENT = [1, 0, 1];

/** Формат фиксирован (ADR-0003): ключ другого размера или с другой экспонентой не принимаем. */
function assertRecipientKeyFormat(key: CryptoKey): void {
  const a = key.algorithm as Partial<RsaHashedKeyAlgorithm>;
  const exponent = a.publicExponent ? [...a.publicExponent] : [];
  const ok =
    a.name === 'RSA-OAEP' &&
    a.modulusLength === RSA_MODULUS_BITS &&
    exponent.length === RSA_PUBLIC_EXPONENT.length &&
    exponent.every((b, i) => b === RSA_PUBLIC_EXPONENT[i]);
  if (!ok) throw new CryptoFormatError('Recipient key must be RSA-OAEP 3072 with exponent 65537');
}

export async function importPublicKey(spkiB64: string): Promise<CryptoKey> {
  let key: CryptoKey;
  try {
    key = await subtle().importKey('spki', fromB64(spkiB64), { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
  } catch (e) {
    if (e instanceof CryptoFormatError) throw e;
    throw new CryptoFormatError('Invalid recipient public key');
  }
  assertRecipientKeyFormat(key);
  return key;
}

/** Отпечаток: SHA-256 (hex) строки ключа без внешних пробелов — ровно то, что считает сервер (#167). */
export async function keyFingerprint(pubkey: string): Promise<string> {
  const digest = new Uint8Array(await subtle().digest('SHA-256', enc.encode(pubkey.trim())));
  return [...digest].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function wrapDekForRecipient(dek: CryptoKey, recipientPublicKey: string, vaultId: string, blockId: string): Promise<string> {
  const pub = await importPublicKey(recipientPublicKey);
  const wrapped = await subtle().encrypt({ name: 'RSA-OAEP', label: contextOf('dek', vaultId, blockId) }, pub, await exportRawKey(dek));
  return toB64(new Uint8Array(wrapped));
}
export async function unwrapDekForRecipient(wrapped: string, privateKey: CryptoKey, vaultId: string, blockId: string): Promise<CryptoKey> {
  try {
    const raw = await subtle().decrypt({ name: 'RSA-OAEP', label: contextOf('dek', vaultId, blockId) }, privateKey, fromB64(wrapped));
    return importRawKey(new Uint8Array(raw));
  } catch (e) {
    if (e instanceof CryptoFormatError) throw e;
    throw new CryptoDecryptError('Decryption failed');
  }
}

// ---------- резервная копия закрытого ключа получателя (файл, на сервер не уходит) ----------
const PBKDF2_ITERATIONS = 600_000;
const MIN_ITERATIONS = 100_000;
const MAX_ITERATIONS = 5_000_000;
const validIterations = (n: unknown): n is number => Number.isInteger(n) && (n as number) >= MIN_ITERATIONS && (n as number) <= MAX_ITERATIONS;

async function passphraseKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as Bytes, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function exportKeyBackup(privateKey: CryptoKey, passphrase: string, iterations = PBKDF2_ITERATIONS): Promise<string> {
  if (passphrase.length < 12) throw new CryptoFormatError('Passphrase must be at least 12 characters');
  // файл, который не восстановится при импорте, создавать нельзя: узнали бы только после потери ключа
  if (privateKey.type !== 'private') throw new CryptoFormatError('A private key is required');
  assertRecipientKeyFormat(privateKey);
  // те же границы, что у импорта: файл, который сами же не примем, и ослабленную защиту не создаём
  if (!validIterations(iterations)) throw new CryptoFormatError('Invalid iteration count');
  const salt = random(16);
  const pkcs8 = new Uint8Array(await subtle().exportKey('pkcs8', privateKey));
  const sealed = await seal(await passphraseKey(passphrase, salt, iterations), pkcs8, enc.encode('afterlight/v1/key-backup'));
  return JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iterations, salt: toB64Url(salt), data: sealed });
}

export async function importKeyBackup(file: string, passphrase: string): Promise<CryptoKey> {
  let parsed: { v?: number; kdf?: string; iterations?: number; salt?: string; data?: string } | null;
  try {
    parsed = JSON.parse(file);
  } catch {
    throw new CryptoFormatError('Invalid backup file');
  }
  // допустимый JSON не обязан быть объектом: null, число, строка, массив
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new CryptoFormatError('Invalid backup file');
  if (parsed.v !== 1 || parsed.kdf !== 'PBKDF2-SHA256' || typeof parsed.salt !== 'string' || typeof parsed.data !== 'string') throw new CryptoFormatError('Unsupported backup file');
  // защита от файла с подложенным числом итераций: меньше разумного предела не принимаем
  if (!validIterations(parsed.iterations)) throw new CryptoFormatError('Invalid iteration count');
  const pkcs8 = await open(await passphraseKey(passphrase, fromB64Url(parsed.salt), parsed.iterations), parsed.data, enc.encode('afterlight/v1/key-backup'));
  let key: CryptoKey;
  try {
    key = await subtle().importKey('pkcs8', pkcs8, { name: 'RSA-OAEP', hash: 'SHA-256' }, true, ['decrypt']);
  } catch {
    throw new CryptoDecryptError('Decryption failed');
  }
  assertRecipientKeyFormat(key);
  return key;
}
