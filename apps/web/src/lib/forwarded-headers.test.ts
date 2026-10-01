import { describe, it, expect } from 'vitest';
import { withTrustedClientAddress } from './forwarded-headers';

const incoming = () => new Headers({ 'x-forwarded-for': '6.6.6.6, 10.0.0.1', 'x-real-ip': '7.7.7.7', forwarded: 'for=8.8.8.8', cookie: 'token=abc', 'content-type': 'application/json' });

describe('withTrustedClientAddress', () => {
  it('drops client supplied address headers by default so that the IP cannot be spoofed', () => {
    const out = withTrustedClientAddress(incoming(), false);
    expect(out.get('x-forwarded-for')).toBeNull();
    expect(out.get('x-real-ip')).toBeNull();
    expect(out.get('forwarded')).toBeNull();
  });

  it('behind a trusted edge proxy it passes only X-Forwarded-For through', () => {
    const out = withTrustedClientAddress(incoming(), true);
    expect(out.get('x-forwarded-for')).toBe('6.6.6.6, 10.0.0.1');
    expect(out.get('x-real-ip')).toBeNull();
    expect(out.get('forwarded')).toBeNull();
  });

  it('keeps every other header and does not touch the input', () => {
    const source = incoming();
    const out = withTrustedClientAddress(source, false);
    expect(out.get('cookie')).toBe('token=abc');
    expect(out.get('content-type')).toBe('application/json');
    expect(source.get('x-forwarded-for')).toBe('6.6.6.6, 10.0.0.1');
  });

  it('with the edge proxy trusted but no header present nothing is invented', () => {
    expect(withTrustedClientAddress(new Headers({ cookie: 'a=b' }), true).get('x-forwarded-for')).toBeNull();
  });
});
