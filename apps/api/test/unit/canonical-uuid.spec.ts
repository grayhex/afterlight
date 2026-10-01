import { describe, it, expect } from '@jest/globals';
import { BadRequestException } from '@nestjs/common';
import { CANONICAL_UUID_PATTERN, CanonicalUuidPipe } from '../../src/common/canonical-uuid.js';

describe('canonical UUID (identifiers bound into the encryption context)', () => {
  const ok = '0b8f6c3e-2a41-4d7f-9c55-1e2d3c4b5a69';
  const pipe = new CanonicalUuidPipe();

  it('accepts lowercase UUIDs only', () => {
    expect(CANONICAL_UUID_PATTERN.test(ok)).toBe(true);
    expect(pipe.transform(ok)).toBe(ok);
    for (const bad of [ok.toUpperCase(), ok.replace('0b8f', '0B8f'), ` ${ok}`, `${ok}\n`, ok.replace(/-/g, ''), '', 'not-a-uuid', `{${ok}}`]) {
      expect([bad, CANONICAL_UUID_PATTERN.test(bad)]).toEqual([bad, false]);
      expect(() => pipe.transform(bad)).toThrow(BadRequestException);
    }
    expect(() => pipe.transform(undefined as unknown as string)).toThrow(BadRequestException);
  });
});
