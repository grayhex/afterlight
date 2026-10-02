import { describe, it, expect } from 'vitest';
import {
  ApiError,
  OpenDeliveryError,
  claimRecipientKey,
  createRecipientKey,
  formatFingerprint,
  keyFromBackup,
  listDeliveries,
  openDelivery,
  verifyBackupFile,
  type Fetcher,
} from './recipient-flow';
import {
  encryptText,
  exportKeyBackup,
  generateKey,
  generateRecipientKeyPair,
  keyFingerprint,
  wrapDekForRecipient,
  exportPublicKey,
  CryptoFormatError,
} from './vault-crypto';

const VAULT = 'aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa';
const BLOCK = 'bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb';
const PHRASE = 'correct horse battery staple';
const TEXT = 'Пароль от сейфа: correct horse battery staple ✓';

const reply = (status: number, body?: unknown) => new Response(body === undefined ? null : JSON.stringify(body), { status });

describe('recipient flow in the browser', () => {
  // RSA-3072 генерируется секунды: одна пара на файл
  const pairPromise = generateRecipientKeyPair();

  async function delivered(overrides: { vault?: string; block?: string } = {}) {
    const pair = await pairPromise;
    const dek = await generateKey();
    const vault = overrides.vault ?? VAULT;
    const block = overrides.block ?? BLOCK;
    const publicKey = await exportPublicKey(pair.publicKey);
    return {
      pair,
      publicKey,
      payload: {
        block_id: BLOCK,
        vault_id: VAULT,
        ciphertext: await encryptText(dek, TEXT, vault, block),
        dek_wrapped_for_recipient: await wrapDekForRecipient(dek, publicKey, vault, block),
        key_fingerprint: await keyFingerprint(publicKey),
        finalized_at: '2026-10-02T00:00:00.000Z',
      },
    };
  }

  it('creates a key with a backup file that restores it; only the public key and the fingerprint come out', async () => {
    const created = await createRecipientKey(PHRASE);
    expect(Object.keys(created).sort()).toEqual(['backupFile', 'fingerprint', 'publicKey']);
    expect(created.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(created.fingerprint).toBe(await keyFingerprint(created.publicKey));
    expect(created.backupFile).not.toContain(PHRASE);
    expect(JSON.parse(created.backupFile)).toMatchObject({ v: 1, kdf: 'PBKDF2-SHA256' });
    await expect(createRecipientKey('short')).rejects.toBeInstanceOf(CryptoFormatError);
  });

  it('claims the key with PUT /recipients/me/key and passes API errors on', async () => {
    const calls: Array<{ path: string; init?: RequestInit }> = [];
    const ok: Fetcher = async (path, init) => { calls.push({ path, init }); return reply(200, { key_fingerprint: 'f', recipients: 2 }); };
    expect(await claimRecipientKey(ok, 'PUB')).toEqual({ key_fingerprint: 'f', recipients: 2 });
    expect(calls[0].path).toBe('/recipients/me/key');
    expect(calls[0].init?.method).toBe('PUT');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ pubkey: 'PUB' });
    for (const status of [400, 401, 403]) {
      await expect(claimRecipientKey(async () => reply(status), 'PUB')).rejects.toMatchObject({ status });
    }
  });

  it('reads the list to the end, page after page', async () => {
    const page = (from: number, n: number) => Array.from({ length: n }, (_, i) => ({ block_id: `id-${String(from + i).padStart(4, '0')}`, vault_id: 'v', finalized_at: null, size: 1 }));
    const seen: string[] = [];
    const fetcher: Fetcher = async (path) => {
      seen.push(path);
      const cursor = new URL(path, 'http://x').searchParams.get('cursor');
      return reply(200, cursor === null ? page(0, 200) : cursor === 'id-0199' ? page(200, 30) : []);
    };
    const all = await listDeliveries(fetcher);
    expect(all).toHaveLength(230);
    // читаем до пустой страницы: короткая страница ещё не значит конец (сервер вправе отдать меньше, чем просили)
    expect(seen).toEqual([
      '/recipients/me/deliveries?limit=200',
      '/recipients/me/deliveries?limit=200&cursor=id-0199',
      '/recipients/me/deliveries?limit=200&cursor=id-0229',
    ]);
    await expect(listDeliveries(async () => reply(401))).rejects.toBeInstanceOf(ApiError);
    expect(await listDeliveries(async () => reply(200, []))).toEqual([]);
  });

  it('opens a delivered block: backup file + passphrase give back the exact original text', async () => {
    const { pair, payload } = await delivered();
    const backup = await exportKeyBackup(pair.privateKey, PHRASE);
    const fetcher: Fetcher = async (path) => {
      expect(path).toBe(`/recipients/me/deliveries/${BLOCK}`);
      return reply(200, payload);
    };
    expect(await openDelivery(fetcher, BLOCK, backup, PHRASE)).toBe(TEXT);
  });

  it('tells a wrong passphrase or a broken backup file from a block that is not available — before asking the server', async () => {
    const { pair, payload } = await delivered();
    const backup = await exportKeyBackup(pair.privateKey, PHRASE);
    let asked = 0;
    const fetcher: Fetcher = async () => { asked++; return reply(200, payload); };
    for (const [file, phrase] of [[backup, 'a different passphrase'], ['not json', PHRASE], ['null', PHRASE], [JSON.stringify({ v: 2 }), PHRASE]]) {
      await expect(openDelivery(fetcher, BLOCK, file, phrase)).rejects.toMatchObject({ reason: 'backup' });
    }
    expect(asked).toBe(0); // ключ из файла не открыт — на сервер за данными не ходим
    await expect(openDelivery(async () => reply(404), BLOCK, backup, PHRASE)).rejects.toMatchObject({ reason: 'not-available' });
    await expect(openDelivery(async () => reply(403), BLOCK, backup, PHRASE)).rejects.toMatchObject({ status: 403 });
    await expect(openDelivery(async () => { throw new TypeError('offline'); }, BLOCK, backup, PHRASE)).rejects.toMatchObject({ reason: 'network' });
  });

  it('a backup file of ANOTHER recipient or a ciphertext moved to another block never opens', async () => {
    const { payload } = await delivered();
    const stranger = await generateRecipientKeyPair();
    const strangerBackup = await exportKeyBackup(stranger.privateKey, PHRASE);
    await expect(openDelivery(async () => reply(200, payload), BLOCK, strangerBackup, PHRASE)).rejects.toMatchObject({ reason: 'wrong-key' });

    const { pair, payload: moved } = await delivered({ block: 'cccccccc-3333-4333-8333-cccccccccccc' });
    const backup = await exportKeyBackup(pair.privateKey, PHRASE);
    // сервер вернул блок под другим идентификатором: контекст шифрования не совпадает
    await expect(openDelivery(async () => reply(200, moved), BLOCK, backup, PHRASE)).rejects.toBeInstanceOf(OpenDeliveryError);
  });

  it('refuses a block that is not the one asked for, even though it would decrypt', async () => {
    const OTHER = 'cccccccc-3333-4333-8333-cccccccccccc';
    const { pair, payload } = await delivered({ block: OTHER });
    const backup = await exportKeyBackup(pair.privateKey, PHRASE);
    // сервер отвечает на запрос блока BLOCK данными другого блока получателя, ровно с его идентификаторами
    const swapped = { ...payload, block_id: OTHER };
    await expect(openDelivery(async () => reply(200, swapped), BLOCK, backup, PHRASE)).rejects.toMatchObject({ reason: 'mismatch' });
    // тот же блок, но в другом сейфе, чем в списке
    const own = await delivered();
    const ownBackup = await exportKeyBackup(own.pair.privateKey, PHRASE);
    await expect(openDelivery(async () => reply(200, own.payload), BLOCK, ownBackup, PHRASE, 'dddddddd-4444-4444-8444-dddddddddddd')).rejects.toMatchObject({ reason: 'mismatch' });
    expect(await openDelivery(async () => reply(200, own.payload), BLOCK, ownBackup, PHRASE, VAULT)).toBe(TEXT);
  });

  it('checks that a backup file restores exactly this key, and takes the key from an existing file', async () => {
    const created = await createRecipientKey(PHRASE);
    expect(await verifyBackupFile(created.backupFile, PHRASE, created.publicKey)).toEqual({ ok: true });
    expect(await verifyBackupFile(created.backupFile, 'another phrase of enough length', created.publicKey)).toEqual({ ok: false });
    expect(await verifyBackupFile('not json', PHRASE, created.publicKey)).toEqual({ ok: false });
    const other = await createRecipientKey(PHRASE);
    expect(await verifyBackupFile(other.backupFile, PHRASE, created.publicKey)).toEqual({ ok: false }); // файл от другого ключа
    expect(await keyFromBackup(created.backupFile, PHRASE)).toEqual({ publicKey: created.publicKey, fingerprint: created.fingerprint });
    await expect(keyFromBackup(created.backupFile, 'another phrase of enough length')).rejects.toBeDefined();
  });

  it('formats a fingerprint in groups of four for reading aloud', () => {
    expect(formatFingerprint('0123456789abcdef')).toBe('0123 4567 89ab cdef');
    expect(formatFingerprint('')).toBe('');
  });
});
