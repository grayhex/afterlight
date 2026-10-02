import { describe, it, expect } from 'vitest';
import { createHash } from 'node:crypto';
import {
  CryptoDecryptError,
  CryptoFormatError,
  contextOf,
  decryptText,
  encryptText,
  exportKeyBackup,
  exportPublicKey,
  generateKey,
  generateRecipientKeyPair,
  generateRecoveryCode,
  importRawKey,
  importKeyBackup,
  keyFingerprint,
  publicKeyOf,
  open,
  seal,
  unwrapDekForOwner,
  unwrapDekForRecipient,
  unwrapVaultKey,
  wrapDekForOwner,
  wrapDekForRecipient,
  wrapVaultKey,
} from './vault-crypto';

const VAULT = '11111111-1111-4111-8111-111111111111';
const BLOCK = '22222222-2222-4222-8222-222222222222';
const text = 'Пароль от сейфа: correct horse battery staple ✓';

// RSA-3072 генерируется медленно: одна пара на файл
const pairPromise = generateRecipientKeyPair();

describe('block envelope (AES-256-GCM, v1)', () => {
  it('round-trips text and uses a fresh IV every time', async () => {
    const dek = await generateKey();
    const a = await encryptText(dek, text, VAULT, BLOCK);
    const b = await encryptText(dek, text, VAULT, BLOCK);
    expect(a).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(a).not.toBe(b);
    expect(a).not.toContain('correct');
    expect(await decryptText(dek, a, VAULT, BLOCK)).toBe(text);
  });

  it('rejects a corrupted ciphertext, a wrong key and a foreign context', async () => {
    const dek = await generateKey();
    const env = await encryptText(dek, text, VAULT, BLOCK);
    const [v, iv, ct] = env.split('.');
    const flipped = ct.slice(0, 5) + (ct[5] === 'A' ? 'B' : 'A') + ct.slice(6);
    await expect(decryptText(dek, `${v}.${iv}.${flipped}`, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(decryptText(dek, `${v}.${iv}.${ct.slice(0, -4)}`, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(decryptText(await generateKey(), env, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoDecryptError);
    // шифротекст нельзя переложить в другой блок или сейф
    await expect(decryptText(dek, env, VAULT, '33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(decryptText(dek, env, '44444444-4444-4444-8444-444444444444', BLOCK)).rejects.toBeInstanceOf(CryptoDecryptError);
  });

  it('refuses unknown versions and malformed envelopes before touching the key', async () => {
    const dek = await generateKey();
    const ctx = contextOf('block', VAULT, BLOCK);
    for (const bad of ['', 'v2.AAAA.AAAA', 'v1.AAAA', 'v1.AAAA.AAAA.AAAA', 'v1.AA.AAAA']) {
      await expect(open(dek, bad, ctx)).rejects.toBeInstanceOf(CryptoFormatError);
    }
  });

  it('seal/open work on arbitrary bytes', async () => {
    const key = await generateKey();
    const ctx = contextOf('mk', VAULT);
    const payload = new Uint8Array([0, 1, 2, 255]);
    expect(Array.from(await open(key, await seal(key, payload, ctx), ctx))).toEqual([0, 1, 2, 255]);
  });
});

describe('identifiers in the encryption context are canonical UUIDs', () => {
  it('refuses uppercase, malformed or placeholder ids instead of encrypting for a context nobody can rebuild', async () => {
    const dek = await generateKey();
    const withLetters = 'abcdefab-cdef-4bcd-8fab-cdefabcdefab'; // в UUID из цифр регистр не виден
    expect(contextOf('block', VAULT, withLetters)).toBeTruthy();
    for (const bad of [withLetters.toUpperCase(), 'block-1', '', ` ${BLOCK}`]) {
      await expect(encryptText(dek, text, VAULT, bad)).rejects.toBeInstanceOf(CryptoFormatError);
    }
    await expect(encryptText(dek, text, withLetters.toUpperCase(), BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(wrapVaultKey(dek, generateRecoveryCode(), withLetters.toUpperCase())).rejects.toBeInstanceOf(CryptoFormatError);
    // у ключа сейфа блока нет: «-» допустим только как отсутствие блока
    expect(contextOf('mk', VAULT)).toBeTruthy();
  });
});

describe('symmetric keys are always AES-256', () => {
  it('rejects raw keys that are not 32 bytes, and AES-128 keys passed to seal/open', async () => {
    for (const n of [0, 16, 24, 31, 33, 64]) {
      await expect(importRawKey(new Uint8Array(n))).rejects.toBeInstanceOf(CryptoFormatError);
    }
    expect(await importRawKey(new Uint8Array(32))).toBeTruthy();

    const aes128 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
    await expect(seal(aes128, new Uint8Array([1]), contextOf('block', VAULT, BLOCK))).rejects.toBeInstanceOf(CryptoFormatError);
    const good = await generateKey();
    const envelope = await seal(good, new Uint8Array([1]), contextOf('block', VAULT, BLOCK));
    await expect(open(aes128, envelope, contextOf('block', VAULT, BLOCK))).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('refuses to wrap a key that is not AES-256 (the result could not be restored later)', async () => {
    const aes128 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
    const aes192 = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 192 }, true, ['encrypt', 'decrypt']);
    const mk = await generateKey();
    const pub = await exportPublicKey((await pairPromise).publicKey);
    for (const weak of [aes128, aes192]) {
      await expect(wrapDekForOwner(mk, weak, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
      await expect(wrapVaultKey(weak, generateRecoveryCode(), VAULT)).rejects.toBeInstanceOf(CryptoFormatError);
      await expect(wrapDekForRecipient(weak, pub, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    }
  });
});

describe('owner path: DEK under the vault key, vault key under the recovery code', () => {
  it('a new device with only the recovery code reads the block', async () => {
    const mk = await generateKey();
    const dek = await generateKey();
    const code = generateRecoveryCode();
    expect(code).toMatch(/^([0-9A-Z]{5}-){10}[0-9A-Z]{2}$/);

    const envelope = await encryptText(dek, text, VAULT, BLOCK);
    const dekWrapped = await wrapDekForOwner(mk, dek, VAULT, BLOCK);
    const mkWrapped = await wrapVaultKey(mk, code, VAULT);
    expect(mkWrapped + dekWrapped).not.toMatch(/correct/);

    // «новое устройство»: известны только recovery-код и то, что хранит сервер
    const mk2 = await unwrapVaultKey(mkWrapped, code.toLowerCase().replace(/-/g, ' '), VAULT);
    const dek2 = await unwrapDekForOwner(mk2, dekWrapped, VAULT, BLOCK);
    expect(await decryptText(dek2, envelope, VAULT, BLOCK)).toBe(text);
  });

  it('a wrong or foreign recovery code, or another vault, does not open the vault key', async () => {
    const mk = await generateKey();
    const code = generateRecoveryCode();
    const mkWrapped = await wrapVaultKey(mk, code, VAULT);
    await expect(unwrapVaultKey(mkWrapped, generateRecoveryCode(), VAULT)).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(unwrapVaultKey(mkWrapped, code, '44444444-4444-4444-8444-444444444444')).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(unwrapVaultKey(mkWrapped, 'short', VAULT)).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('recovery codes are unique and carry 256 bits', async () => {
    const codes = new Set(Array.from({ length: 50 }, generateRecoveryCode));
    expect(codes.size).toBe(50);
  });
});

describe('recipient path: RSA-OAEP wrapping under the confirmed key', () => {
  it('only the private key of the recipient unwraps the DEK; the plaintext is then readable', async () => {
    const pair = await pairPromise;
    const pub = await exportPublicKey(pair.publicKey);
    const dek = await generateKey();
    const envelope = await encryptText(dek, text, VAULT, BLOCK);
    const wrapped = await wrapDekForRecipient(dek, pub, VAULT, BLOCK);

    const unwrapped = await unwrapDekForRecipient(wrapped, pair.privateKey, VAULT, BLOCK);
    expect(await decryptText(unwrapped, envelope, VAULT, BLOCK)).toBe(text);

    const stranger = await generateRecipientKeyPair();
    await expect(unwrapDekForRecipient(wrapped, stranger.privateKey, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoDecryptError);
    // упаковка привязана к блоку через label
    await expect(unwrapDekForRecipient(wrapped, pair.privateKey, VAULT, '33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(CryptoDecryptError);
    await expect(unwrapDekForRecipient('!!!', pair.privateKey, VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('refuses a recipient key that is not RSA-3072 with e=65537 (nothing is encrypted under it)', async () => {
    const dek = await generateKey();
    const weak = async (modulusLength: number, publicExponent: number[]) => {
      const pair = (await crypto.subtle.generateKey(
        { name: 'RSA-OAEP', modulusLength, publicExponent: new Uint8Array(publicExponent), hash: 'SHA-256' },
        true,
        ['encrypt', 'decrypt'],
      )) as CryptoKeyPair;
      return exportPublicKey(pair.publicKey);
    };
    await expect(wrapDekForRecipient(dek, await weak(1024, [1, 0, 1]), VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(wrapDekForRecipient(dek, await weak(2048, [1, 0, 1]), VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(wrapDekForRecipient(dek, await weak(2048, [3]), VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    // не SPKI вообще и не RSA
    await expect(wrapDekForRecipient(dek, 'bm90IGEga2V5', VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
    const ec = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    await expect(wrapDekForRecipient(dek, await exportPublicKey(ec.publicKey), VAULT, BLOCK)).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('derives the public key from the private one: exactly what the browser exported at the creation', async () => {
    const pair = await pairPromise;
    const exported = await exportPublicKey(pair.publicKey);
    expect(await publicKeyOf(pair.privateKey)).toBe(exported);
    // и из ключа, восстановленного из резервного файла
    const restored = await importKeyBackup(await exportKeyBackup(pair.privateKey, 'correct horse battery staple'), 'correct horse battery staple');
    expect(await publicKeyOf(restored)).toBe(exported);
    await expect(publicKeyOf(pair.publicKey)).rejects.toBeInstanceOf(CryptoFormatError);
    const weak = (await crypto.subtle.generateKey({ name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['encrypt', 'decrypt'])) as CryptoKeyPair;
    await expect(publicKeyOf(weak.privateKey)).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('the fingerprint equals what the server computes (SHA-256 hex of the trimmed key string)', async () => {
    const pair = await pairPromise;
    const pub = await exportPublicKey(pair.publicKey);
    const serverSide = createHash('sha256').update(pub.trim(), 'utf8').digest('hex');
    expect(await keyFingerprint(pub)).toBe(serverSide);
    expect(await keyFingerprint(`  ${pub}\n`)).toBe(serverSide);
    expect(serverSide).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('formats match what the server accepts (apps/api/src/common/envelope.ts)', () => {
  // Шаблоны продублированы намеренно: если сервер или клиент изменят формат, один из двух тестов упадёт
  const KEY_ENVELOPE = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{64}$/;
  const CIPHERTEXT = /^v1\.[A-Za-z0-9_-]{16}\.[A-Za-z0-9_-]{22,}$/;

  it('wrapped keys, ciphertexts and the recipient wrapping have the shapes the API validates', async () => {
    const mk = await generateKey();
    const dek = await generateKey();
    const code = generateRecoveryCode();
    expect(await wrapVaultKey(mk, code, VAULT)).toMatch(KEY_ENVELOPE);
    expect(await wrapDekForOwner(mk, dek, VAULT, BLOCK)).toMatch(KEY_ENVELOPE);
    for (const t of ['', 'a', text, 'x'.repeat(5000)]) expect(await encryptText(dek, t, VAULT, BLOCK)).toMatch(CIPHERTEXT);

    const pub = await exportPublicKey((await pairPromise).publicKey);
    const wrapped = await wrapDekForRecipient(dek, pub, VAULT, BLOCK);
    expect(wrapped).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(Buffer.from(wrapped, 'base64')).toHaveLength(384);
  });
});

describe('recipient key backup file (passphrase protected, never sent to the server)', () => {
  it('refuses to create a backup of a key that the import would not accept', async () => {
    const rsa2048 = (await crypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    )) as CryptoKeyPair;
    const ec = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
    const pair = await pairPromise;
    const phrase = 'correct horse battery staple';
    await expect(exportKeyBackup(rsa2048.privateKey, phrase)).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(exportKeyBackup(ec.privateKey, phrase)).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(exportKeyBackup(pair.publicKey, phrase)).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('restores the private key on a new device, and refuses a wrong passphrase or a tampered file', async () => {
    const pair = await pairPromise;
    const pub = await exportPublicKey(pair.publicKey);
    const dek = await generateKey();
    const wrapped = await wrapDekForRecipient(dek, pub, VAULT, BLOCK);

    // в тесте — минимальное допустимое число итераций, чтобы не ждать
    const file = await exportKeyBackup(pair.privateKey, 'a long enough passphrase', 100_000);
    expect(file).not.toMatch(/PRIVATE|MII/);

    const restored = await importKeyBackup(file, 'a long enough passphrase');
    expect(await unwrapDekForRecipient(wrapped, restored, VAULT, BLOCK)).toBeTruthy();

    await expect(importKeyBackup(file, 'another long passphrase')).rejects.toBeInstanceOf(CryptoDecryptError);
    const weakened = JSON.stringify({ ...JSON.parse(file), iterations: 1 });
    await expect(importKeyBackup(weakened, 'a long enough passphrase')).rejects.toBeInstanceOf(CryptoFormatError);
    await expect(importKeyBackup('not json', 'x')).rejects.toBeInstanceOf(CryptoFormatError);
    // валидный JSON, но не объект: ошибка формата, а не TypeError
    for (const bad of ['null', '42', '"text"', '[]', 'true']) {
      await expect(importKeyBackup(bad, 'x')).rejects.toBeInstanceOf(CryptoFormatError);
    }
    await expect(importKeyBackup(JSON.stringify({ v: 2 }), 'x')).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('refuses short passphrases', async () => {
    const pair = await pairPromise;
    await expect(exportKeyBackup(pair.privateKey, 'short')).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('refuses work factors that the importer would not accept (export and import share one range)', async () => {
    const pair = await pairPromise;
    for (const bad of [0, 1, 99_999, 5_000_001, 1.5, Number.NaN]) {
      await expect(exportKeyBackup(pair.privateKey, 'a long enough passphrase', bad)).rejects.toBeInstanceOf(CryptoFormatError);
    }
    const edge = await exportKeyBackup(pair.privateKey, 'a long enough passphrase', 100_000);
    expect(JSON.parse(edge).iterations).toBe(100_000);
    await expect(importKeyBackup(edge, 'a long enough passphrase')).resolves.toBeTruthy();
  });
});
