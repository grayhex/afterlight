import { describe, it, expect, afterEach } from '@jest/globals';
import { ClockService } from '../../src/clock/clock.service.js';

describe('ClockService', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('is the system clock by default and managed only in the test environment', () => {
    const clock = new ClockService();
    process.env.NODE_ENV = 'test';
    clock.setNow(new Date('2026-01-01T00:00:00.000Z'));
    clock.advance(3600 * 1000);
    expect(clock.now().toISOString()).toBe('2026-01-01T01:00:00.000Z');
    clock.reset();
    expect(Math.abs(clock.now().getTime() - Date.now())).toBeLessThan(1000);
  });

  it('refuses to manage time in production', () => {
    process.env.NODE_ENV = 'production';
    const clock = new ClockService();
    expect(() => clock.setNow(new Date())).toThrow(/test environment/);
    expect(() => clock.advance(1)).toThrow(/test environment/);
    expect(clock.now()).toBeInstanceOf(Date);
  });
});
