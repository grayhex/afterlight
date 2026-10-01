import { describe, it, expect } from '@jest/globals';
import { docsEnabled } from '../../src/docs.setup.js';

describe('docsEnabled', () => {
  const e = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
  it('is off in production by default and on elsewhere', () => {
    expect(docsEnabled(e({ NODE_ENV: 'production' }))).toBe(false);
    expect(docsEnabled(e({ NODE_ENV: 'development' }))).toBe(true);
    expect(docsEnabled(e({ NODE_ENV: 'test' }))).toBe(true);
    expect(docsEnabled(e({}))).toBe(true);
  });

  it('SWAGGER_ENABLED overrides in both directions; any other value falls back to the default', () => {
    expect(docsEnabled(e({ NODE_ENV: 'production', SWAGGER_ENABLED: 'true' }))).toBe(true);
    expect(docsEnabled(e({ NODE_ENV: 'production', SWAGGER_ENABLED: ' TRUE ' }))).toBe(true);
    expect(docsEnabled(e({ NODE_ENV: 'development', SWAGGER_ENABLED: 'false' }))).toBe(false);
    for (const odd of ['', '1', 'yes', 'on']) {
      expect(docsEnabled(e({ NODE_ENV: 'production', SWAGGER_ENABLED: odd }))).toBe(false);
      expect(docsEnabled(e({ NODE_ENV: 'development', SWAGGER_ENABLED: odd }))).toBe(true);
    }
  });
});
