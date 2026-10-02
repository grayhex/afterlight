/**
 * Путь получателя в браузере (ADR-0003): ключ создаётся и остаётся у получателя, на сервер уходит только открытая часть;
 * переданный блок расшифровывается здесь же. Сетевой слой передаётся снаружи (httpClient или подмена в тестах),
 * ключи и открытый текст нигде не сохраняются: ни в localStorage, ни в cookie, ни в журнал.
 */
import {
  CryptoDecryptError,
  CryptoFormatError,
  decryptText,
  exportKeyBackup,
  exportPublicKey,
  generateRecipientKeyPair,
  importKeyBackup,
  keyFingerprint,
  unwrapDekForRecipient,
} from './vault-crypto';

export type Fetcher = (path: string, init?: RequestInit) => Promise<Response>;

export const MIN_PASSPHRASE = 12;

export class ApiError extends Error {
  constructor(public readonly status: number, message?: string) {
    super(message ?? `HTTP ${status}`);
  }
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) throw new ApiError(res.status);
  return (await res.json()) as T;
}

export interface NewRecipientKey {
  /** Открытый ключ (SPKI, base64) — то, что уйдёт на сервер. */
  publicKey: string;
  /** SHA-256 (hex): его получатель сообщает владельцу вне сервера. */
  fingerprint: string;
  /** Резервный файл закрытого ключа (JSON), зашифрованный парольной фразой. Обязателен до заявки ключа. */
  backupFile: string;
}

/** Создаёт пару ключей и резервный файл. Закрытый ключ наружу не отдаётся и дальше этой функции не живёт. */
export async function createRecipientKey(passphrase: string): Promise<NewRecipientKey> {
  if (passphrase.length < MIN_PASSPHRASE) throw new CryptoFormatError(`Passphrase must be at least ${MIN_PASSPHRASE} characters`);
  const pair = await generateRecipientKeyPair();
  const publicKey = await exportPublicKey(pair.publicKey);
  return { publicKey, fingerprint: await keyFingerprint(publicKey), backupFile: await exportKeyBackup(pair.privateKey, passphrase) };
}

/** Заявляет ключ для всех сейфов, где адрес аккаунта назначен получателем. Владелец потом подтверждает отпечаток. */
export async function claimRecipientKey(fetcher: Fetcher, publicKey: string): Promise<{ key_fingerprint: string; recipients: number }> {
  const res = await fetcher('/recipients/me/key', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pubkey: publicKey }),
  });
  return json(res);
}

export interface DeliveryItem {
  block_id: string;
  vault_id: string;
  finalized_at: string | null;
  size: number;
}

/** Все выдачи: список постраничный на сервере, здесь он читается до конца. */
export async function listDeliveries(fetcher: Fetcher): Promise<DeliveryItem[]> {
  const all: DeliveryItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < 1000; page++) {
    const q = new URLSearchParams({ limit: '200', ...(cursor ? { cursor } : {}) });
    const items = await json<DeliveryItem[]>(await fetcher(`/recipients/me/deliveries?${q}`));
    all.push(...items);
    if (items.length < 200) return all;
    cursor = items[items.length - 1].block_id;
  }
  return all;
}

interface DeliveredBlock {
  block_id: string;
  vault_id: string;
  ciphertext: string;
  dek_wrapped_for_recipient: string;
  key_fingerprint: string;
  finalized_at: string | null;
}

export type OpenError = 'backup' | 'wrong-key' | 'not-available' | 'network';

export class OpenDeliveryError extends Error {
  constructor(public readonly reason: OpenError) {
    super(reason);
  }
}

/**
 * Расшифровывает переданный блок: резервный файл + парольная фраза → закрытый ключ → ключ блока → текст.
 * Причину отказа различаем только настолько, насколько это помогает человеку (не тот файл или фраза / ещё не передано).
 */
export async function openDelivery(fetcher: Fetcher, blockId: string, backupFile: string, passphrase: string): Promise<string> {
  let privateKey: CryptoKey;
  try {
    privateKey = await importKeyBackup(backupFile, passphrase);
  } catch (e) {
    if (e instanceof CryptoFormatError || e instanceof CryptoDecryptError) throw new OpenDeliveryError('backup');
    throw e;
  }
  let delivered: DeliveredBlock;
  try {
    delivered = await json<DeliveredBlock>(await fetcher(`/recipients/me/deliveries/${blockId}`));
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new OpenDeliveryError('not-available');
    if (e instanceof ApiError) throw e;
    throw new OpenDeliveryError('network');
  }
  try {
    const dek = await unwrapDekForRecipient(delivered.dek_wrapped_for_recipient, privateKey, delivered.vault_id, delivered.block_id);
    return await decryptText(dek, delivered.ciphertext, delivered.vault_id, delivered.block_id);
  } catch (e) {
    // другой ключ (файл от другого получателя), повреждённая упаковка или шифротекст — для человека это одно и то же
    if (e instanceof CryptoDecryptError || e instanceof CryptoFormatError) throw new OpenDeliveryError('wrong-key');
    throw e;
  }
}

/** Отпечаток для чтения вслух и сверки: группы по четыре символа. */
export const formatFingerprint = (hex: string): string => hex.match(/.{1,4}/g)?.join(' ') ?? hex;
