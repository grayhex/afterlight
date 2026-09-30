import { describe, it, expect } from 'vitest';
import { formatRuPhone } from './phone';

describe('formatRuPhone', () => {
  it('formats a full number typed without country code', () => {
    expect(formatRuPhone('9991234567')).toBe('+7 (999) 123-45-67');
  });
  it('accepts +7 / 8 prefixes and already formatted input', () => {
    expect(formatRuPhone('+79991234567')).toBe('+7 (999) 123-45-67');
    expect(formatRuPhone('89991234567')).toBe('+7 (999) 123-45-67');
    expect(formatRuPhone('+7 (999) 123-45-67')).toBe('+7 (999) 123-45-67');
  });
  it('formats partial input progressively and caps at 10 digits', () => {
    expect(formatRuPhone('99')).toBe('+7 (99');
    expect(formatRuPhone('9991')).toBe('+7 (999) 1');
    expect(formatRuPhone('99912345')).toBe('+7 (999) 123-45');
    expect(formatRuPhone('999123456799999')).toBe('+7 (999) 123-45-67');
  });
  it('returns an empty string for empty input', () => {
    expect(formatRuPhone('')).toBe('');
  });
});
