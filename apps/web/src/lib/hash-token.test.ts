import { describe, expect, it, vi } from 'vitest';
import { takeTokenFromHash } from './hash-token';

const fakeWindow = (hash: string, search = '') => {
  const replaceState = vi.fn();
  return {
    win: { location: { hash, pathname: '/verify-email', search }, history: { replaceState } } as unknown as Window,
    replaceState,
  };
};

describe('takeTokenFromHash', () => {
  it('returns the token from the fragment and removes it from the address bar', () => {
    const { win, replaceState } = fakeWindow('#token=abc_DEF-123');
    expect(takeTokenFromHash(win)).toBe('abc_DEF-123');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/verify-email');
  });

  it('returns null when there is no token (and still cleans the fragment)', () => {
    const { win, replaceState } = fakeWindow('#other=1');
    expect(takeTokenFromHash(win)).toBeNull();
    expect(takeTokenFromHash(fakeWindow('').win)).toBeNull();
    expect(takeTokenFromHash(fakeWindow('#token=').win)).toBeNull();
    expect(replaceState).toHaveBeenCalled();
  });

  it('keeps the query string when it clears the fragment', () => {
    const { win, replaceState } = fakeWindow('#token=x', '?lang=ru');
    takeTokenFromHash(win);
    expect(replaceState).toHaveBeenCalledWith(null, '', '/verify-email?lang=ru');
  });
});
