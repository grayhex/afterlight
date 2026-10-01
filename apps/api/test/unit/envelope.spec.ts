import { describe, it, expect } from '@jest/globals';
import {
  CIPHERTEXT_ENVELOPE_PATTERN,
  KEY_ENVELOPE_PATTERN,
  RSA_3072_WRAP_BYTES,
  isRsa3072Wrap,
} from '../../src/common/envelope.js';

const iv = 'A'.repeat(16);

describe('client format validators (ADR-0003)', () => {
  it('a wrapped 256-bit key is exactly v1.<16>.<64> in base64url', () => {
    expect(KEY_ENVELOPE_PATTERN.test(`v1.${iv}.${'B'.repeat(64)}`)).toBe(true);
    expect(KEY_ENVELOPE_PATTERN.test(`v1.${iv}.${'B-_'.repeat(21)}B`)).toBe(true);
    const bad = [
      '', 'dek', 'ZGVr',
      `v2.${iv}.${'B'.repeat(64)}`,
      `v1.${iv}.${'B'.repeat(63)}`,
      `v1.${iv}.${'B'.repeat(65)}`,
      `v1.${'A'.repeat(15)}.${'B'.repeat(64)}`,
      `v1.${iv}.${'B'.repeat(63)}=`,
      `v1.${iv}.${'B'.repeat(63)}+`,
      `v1.${iv}.${'B'.repeat(64)}\n`,
      ` v1.${iv}.${'B'.repeat(64)}`,
    ];
    for (const v of bad) expect([v, KEY_ENVELOPE_PATTERN.test(v)]).toEqual([v, false]);
  });

  it('a block ciphertext carries at least the 16-byte GCM tag', () => {
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.${'C'.repeat(22)}`)).toBe(true);
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.${'C'.repeat(21)}`)).toBe(false);
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.${'C'.repeat(500)}`)).toBe(true);
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.`)).toBe(false);
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.${'C'.repeat(30)}.x`)).toBe(false);
    expect(CIPHERTEXT_ENVELOPE_PATTERN.test(`v1.${iv}.${'C'.repeat(30)}==`)).toBe(false);
  });

  it('an RSA-OAEP 3072 wrapping is canonical base64 of exactly 384 bytes', () => {
    expect(RSA_3072_WRAP_BYTES).toBe(384);
    expect(isRsa3072Wrap(Buffer.alloc(384, 9).toString('base64'))).toBe(true);
    for (const n of [0, 1, 32, 256, 383, 385, 512]) {
      expect([n, isRsa3072Wrap(Buffer.alloc(n, 9).toString('base64'))]).toEqual([n, false]);
    }
    const ok = Buffer.alloc(384, 9).toString('base64');
    expect(isRsa3072Wrap(ok.slice(0, -2))).toBe(false); // потерян хвост
    expect(isRsa3072Wrap(`${ok}\n`)).toBe(false);
    // байты 0xFB дают в base64 символы «+» и «/»; их url-вариант («-», «_») — не стандартный base64
    const withPlusSlash = Buffer.alloc(384, 0xfb).toString('base64');
    expect(withPlusSlash).toMatch(/[+/]/);
    expect(isRsa3072Wrap(withPlusSlash)).toBe(true);
    expect(isRsa3072Wrap(withPlusSlash.replace(/\+/g, '-').replace(/\//g, '_'))).toBe(false);
    expect(isRsa3072Wrap('d3JhcHBlZA==')).toBe(false);
    expect(isRsa3072Wrap(undefined)).toBe(false);
    expect(isRsa3072Wrap(384)).toBe(false);
  });
});
