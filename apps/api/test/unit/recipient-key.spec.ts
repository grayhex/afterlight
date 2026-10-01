import { describe, it, expect } from '@jest/globals';
import { generateKeyPairSync, webcrypto } from 'crypto';
import { isRecipientPublicKey } from '../../src/common/recipient-key.js';
import { rsaSpki } from '../support/rsa-spki.js';

const spkiOf = (key: import('crypto').KeyObject) => key.export({ format: 'der', type: 'spki' }).toString('base64');

describe('recipient public key format (ADR-0003: RSA-OAEP 3072, e = 65537)', () => {
  it('accepts what the browser exports: a real RSA-3072 key from WebCrypto', async () => {
    const pair = (await webcrypto.subtle.generateKey(
      { name: 'RSA-OAEP', modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      true,
      ['encrypt', 'decrypt'],
    )) as webcrypto.CryptoKeyPair;
    const spki = Buffer.from(await webcrypto.subtle.exportKey('spki', pair.publicKey)).toString('base64');
    expect(isRecipientPublicKey(spki)).toBe(true);
  });

  it('accepts the synthetic keys of the tests (structure and size only)', () => {
    for (const label of ['a', 'b', 'KEY-P']) expect(isRecipientPublicKey(rsaSpki(label))).toBe(true);
    expect(rsaSpki('a')).not.toBe(rsaSpki('b'));
  });

  it('refuses other sizes and exponents', () => {
    for (const bits of [512, 1024, 2048, 4096]) expect([bits, isRecipientPublicKey(rsaSpki('k', { bits }))]).toEqual([bits, false]);
    for (const exponent of [3, 17, 257, 65539]) expect([exponent, isRecipientPublicKey(rsaSpki('k', { exponent }))]).toEqual([exponent, false]);
  });

  it('refuses keys of other types', () => {
    const keys = [
      generateKeyPairSync('rsa-pss', { modulusLength: 2048 }).publicKey,
      generateKeyPairSync('ec', { namedCurve: 'P-256' }).publicKey,
      generateKeyPairSync('ed25519').publicKey,
    ];
    for (const key of keys) expect([key.asymmetricKeyType, isRecipientPublicKey(spkiOf(key))]).toEqual([key.asymmetricKeyType, false]);
  });

  it('refuses everything that is not a canonical SPKI in standard base64', () => {
    const ok = rsaSpki('k');
    const der = Buffer.from(ok, 'base64');
    const bad: unknown[] = [
      undefined, null, 7, '', ' ', 'KEY-P', 'K',
      `${ok}\n`, ` ${ok}`, `${ok} `, ok.slice(0, -4), `${ok}AAAA`,
      ok.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') + '!',
      `-----BEGIN PUBLIC KEY-----\n${ok}\n-----END PUBLIC KEY-----`,
      Buffer.concat([der, Buffer.from([0, 0, 0])]).toString('base64'), // хвостовой мусор после DER
      der.toString('hex'),
      'A'.repeat(5000),
    ];
    for (const v of bad) expect([String(v).slice(0, 24), isRecipientPublicKey(v)]).toEqual([String(v).slice(0, 24), false]);
    // base64 без «=» в конце — не канонический вид
    if (ok.endsWith('=')) expect(isRecipientPublicKey(ok.replace(/=+$/, ''))).toBe(false);
  });
});
