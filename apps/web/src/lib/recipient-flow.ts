/**
 * Путь получателя в браузере (ADR-0003): ключ создаётся и остаётся у получателя, на сервер уходит только открытая часть;
 * переданный блок расшифровывается здесь же. Сетевой слой передаётся снаружи (httpClient или подмена в тестах),
 * ключи и открытый текст нигде не сохраняются: ни в localStorage, ни в cookie, ни в журнал.
 */
import type { components } from '@/api';
import {
  CryptoDecryptError,
  CryptoFormatError,
  decryptText,
  exportKeyBackup,
  exportPublicKey,
  generateRecipientKeyPair,
  importKeyBackup,
  keyFingerprint,
  publicKeyOf,
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

// Типы берутся из сгенерированного контракта API: расхождение с сервером ломает сборку, а не работу у человека
export type DeliveryItem = components['schemas']['DeliveryItemDto'];
type DeliveredBlock = components['schemas']['DeliveredBlockDto'];

const PAGE = 200;
const MAX_PAGES = 10_000;

/** Все выдачи: список постраничный на сервере, здесь он читается до пустой страницы (а не до первой короткой). */
export async function listDeliveries(fetcher: Fetcher): Promise<DeliveryItem[]> {
  const all: DeliveryItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const q = new URLSearchParams({ limit: String(PAGE), ...(cursor ? { cursor } : {}) });
    const items = await json<DeliveryItem[]>(await fetcher(`/recipients/me/deliveries?${q}`));
    if (items.length === 0) return all;
    all.push(...items);
    cursor = items[items.length - 1].block_id;
  }
  // обрезанный список без ошибки хуже ошибки: получатель решил бы, что передано меньше, чем есть
  throw new Error('Too many deliveries to list');
}

export type OpenError = 'backup' | 'wrong-key' | 'not-available' | 'network' | 'mismatch';

export class OpenDeliveryError extends Error {
  constructor(public readonly reason: OpenError) {
    super(reason);
  }
}

/**
 * Расшифровывает переданный блок: резервный файл + парольная фраза → закрытый ключ → ключ блока → текст.
 * Причину отказа различаем только настолько, насколько это помогает человеку (не тот файл или фраза / ещё не передано).
 */
export async function openDelivery(
  fetcher: Fetcher,
  blockId: string,
  backupFile: string,
  passphrase: string,
  expectedVaultId?: string,
): Promise<string> {
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
  // Контекст шифрования строится из идентификаторов ответа, поэтому сверяем их с тем, что запрошено: иначе сервер мог бы подставить
  // другой блок получателя под видом запрошенного (он расшифровался бы, но показан был бы не тот).
  if (delivered.block_id !== blockId || (expectedVaultId !== undefined && delivered.vault_id !== expectedVaultId)) {
    throw new OpenDeliveryError('mismatch');
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

export type BackupCheck = { ok: true } | { ok: false };

/**
 * Проверяет, что файл с этой фразой действительно восстанавливает ИМЕННО этот ключ. Надёжнее, чем «файл скачан»:
 * браузер не сообщает, сохранён ли файл, а проверка загрузкой показывает, что файл есть, не повреждён и фраза верна.
 */
export async function verifyBackupFile(backupFile: string, passphrase: string, expectedPublicKey: string): Promise<BackupCheck> {
  try {
    return { ok: (await publicKeyOf(await importKeyBackup(backupFile, passphrase))) === expectedPublicKey };
  } catch (e) {
    if (e instanceof CryptoFormatError || e instanceof CryptoDecryptError) return { ok: false };
    throw e;
  }
}

/** Ключ из уже созданного резервного файла: для повторной заявки без создания нового (сохраняет подтверждение владельцев). */
export async function keyFromBackup(backupFile: string, passphrase: string): Promise<{ publicKey: string; fingerprint: string }> {
  const publicKey = await publicKeyOf(await importKeyBackup(backupFile, passphrase));
  return { publicKey, fingerprint: await keyFingerprint(publicKey) };
}

/** Отпечаток для чтения вслух и сверки: группы по четыре символа. */
export const formatFingerprint = (hex: string): string => hex.match(/.{1,4}/g)?.join(' ') ?? hex;
