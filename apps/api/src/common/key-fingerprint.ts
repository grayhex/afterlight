import { createHash } from 'crypto';

/** Отпечаток публичного ключа: SHA-256 (hex) от UTF-8 строки ключа без внешних пробелов. Клиент считает его над той же строкой. */
export const keyFingerprint = (pubkey: string): string => createHash('sha256').update(pubkey.trim(), 'utf8').digest('hex');

/** Отпечаток в произвольной записи (регистр, пробелы, двоеточия) → канонический hex. */
export const normalizeFingerprint = (value: string): string => value.replace(/[\s:]/g, '').toLowerCase();
