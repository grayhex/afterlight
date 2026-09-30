import { describe, it, expect } from '@jest/globals';
import { missingEnvVars, validateEnv } from '../../src/env.js';

const base = { JWT_SECRET: 's', DATABASE_URL: 'postgresql://x', CORS_ALLOWED_ORIGINS: 'http://a' };

describe('validateEnv', () => {
  it('accepts a complete development environment without WEB_BASE_URL', () => {
    expect(missingEnvVars({ ...base, NODE_ENV: 'development' })).toEqual([]);
    expect(() => validateEnv(base)).not.toThrow();
  });

  it('requires WEB_BASE_URL in production so invitation links do not point to localhost', () => {
    expect(missingEnvVars({ ...base, NODE_ENV: 'production' })).toEqual(['WEB_BASE_URL']);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', WEB_BASE_URL: '  ' })).toThrow(/WEB_BASE_URL/);
    expect(() => validateEnv({ ...base, NODE_ENV: 'production', WEB_BASE_URL: 'https://app.example.com' })).not.toThrow();
  });

  it('reports every missing required variable', () => {
    expect(missingEnvVars({ NODE_ENV: 'development' })).toEqual(['JWT_SECRET', 'DATABASE_URL', 'CORS_ALLOWED_ORIGINS']);
  });
});
