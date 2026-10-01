import { describe, it, expect } from '@jest/globals';
import { POLICIES, policyOf } from '../../src/rate-limit/rate-limit.service.js';
import { trustProxySetting } from '../../src/app.setup.js';

describe('rate limit configuration', () => {
  it('uses the defaults and honours positive integer overrides only', () => {
    expect(policyOf('register_ip', {})).toEqual(POLICIES.register_ip);
    expect(policyOf('register_ip', { RATE_LIMIT_REGISTER_IP_MAX: '3', RATE_LIMIT_REGISTER_IP_WINDOW_SEC: '60' })).toEqual({ max: 3, windowSec: 60 });
    for (const bad of ['', '0', '-5', '1.5', 'abc', ' ']) {
      expect(policyOf('register_ip', { RATE_LIMIT_REGISTER_IP_MAX: bad, RATE_LIMIT_REGISTER_IP_WINDOW_SEC: bad })).toEqual(POLICIES.register_ip);
    }
  });

  it('every policy has a positive limit and window', () => {
    for (const p of Object.values(POLICIES)) {
      expect(p.max).toBeGreaterThan(0);
      expect(p.windowSec).toBeGreaterThan(0);
    }
  });

  it('parses TRUST_PROXY', () => {
    expect(trustProxySetting(undefined)).toBeUndefined();
    expect(trustProxySetting('  ')).toBeUndefined();
    expect(trustProxySetting('true')).toBe(true);
    expect(trustProxySetting('false')).toBe(false);
    expect(trustProxySetting('2')).toBe(2);
    expect(trustProxySetting('uniquelocal')).toBe('uniquelocal');
    expect(trustProxySetting('loopback, 10.0.0.0/8')).toBe('loopback, 10.0.0.0/8');
  });
});
