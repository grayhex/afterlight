import { describe, it, expect } from '@jest/globals';
import { loadMailConfig, mailConfigProblems } from '../../src/notifications/mail.config.js';
import { classifyMailError } from '../../src/notifications/mail-transport.js';
import { validateEnv } from '../../src/env.js';

const prod = {
  NODE_ENV: 'production', JWT_SECRET: 's', DATABASE_URL: 'postgresql://x', CORS_ALLOWED_ORIGINS: 'https://app.afterlight.org', WEB_BASE_URL: 'https://app.afterlight.org',
  MAIL_FROM: 'AfterLight <no-reply@afterlight.org>', MAIL_SMTP_HOST: 'smtp.afterlight.org',
};

describe('mail config', () => {
  it('requires MAIL_FROM and MAIL_SMTP_HOST in production, with defaults (sandbox) elsewhere', () => {
    expect(mailConfigProblems({ NODE_ENV: 'production' })).toEqual(['MAIL_FROM is required in production', 'MAIL_SMTP_HOST is required in production']);
    expect(mailConfigProblems({})).toEqual([]);
    expect(loadMailConfig({})).toMatchObject({ host: '127.0.0.1', port: 1025, tls: 'none' });
    expect(loadMailConfig(prod)).toMatchObject({ host: 'smtp.afterlight.org', port: 587, tls: 'required', maxAttempts: 12 });
  });

  it('rejects demonstration domains and localhost in production runtime', () => {
    expect(mailConfigProblems({ ...prod, MAIL_FROM: 'no-reply@example.com' })).toEqual([expect.stringContaining('MAIL_FROM must use a real domain')]);
    expect(mailConfigProblems({ ...prod, MAIL_FROM: 'AfterLight <a@afterlight.localhost>' })).toHaveLength(1);
    expect(mailConfigProblems({ ...prod, MAIL_SMTP_HOST: 'smtp.example.org' })).toEqual([expect.stringContaining('MAIL_SMTP_HOST must be a real host')]);
    expect(mailConfigProblems({ ...prod, MAIL_FROM: 'not-an-address' })).toEqual(['MAIL_FROM must contain an email address']);
  });

  it('validates credentials pairing, TLS mode and numeric limits without echoing secrets', () => {
    expect(mailConfigProblems({ ...prod, MAIL_SMTP_USER: 'u' })).toEqual(['MAIL_SMTP_USER and MAIL_SMTP_PASSWORD must be set together']);
    expect(mailConfigProblems({ ...prod, MAIL_SMTP_TLS: 'maybe' })).toHaveLength(1);
    expect(mailConfigProblems({ ...prod, MAIL_MAX_ATTEMPTS: '0' })).toEqual(['MAIL_MAX_ATTEMPTS must be an integer >= 1']);
    expect(mailConfigProblems({ ...prod, MAIL_SMTP_PORT: 'abc' })).toEqual(['MAIL_SMTP_PORT must be an integer >= 1']);
    expect(JSON.stringify(mailConfigProblems({ ...prod, MAIL_SMTP_USER: 'u', MAIL_SMTP_PASSWORD: '' }))).not.toContain('smtp-secret');
  });

  it('validateEnv stops the API on an invalid mail setup', () => {
    expect(() => validateEnv(prod as any)).not.toThrow();
    expect(() => validateEnv({ ...prod, MAIL_SMTP_HOST: '' } as any)).toThrow(/Invalid mail configuration: MAIL_SMTP_HOST is required/);
  });
});

describe('classifyMailError', () => {
  it('5xx and bad envelope are permanent; network, timeout, 4xx and auth are transient', () => {
    expect(classifyMailError({ responseCode: 550, response: '550 No such user' }).permanent).toBe(true);
    expect(classifyMailError({ code: 'EENVELOPE', message: 'No recipients' }).permanent).toBe(true);
    expect(classifyMailError({ code: 'EENVELOPE', responseCode: 451, response: '451 try later' }).permanent).toBe(false);
    expect(classifyMailError({ code: 'EENVELOPE', responseCode: 550, response: '550 no such user' }).permanent).toBe(true);
    expect(classifyMailError({ code: 'ECONNECTION', message: 'refused' }).permanent).toBe(false);
    expect(classifyMailError({ code: 'ETIMEDOUT', message: 'timeout' }).permanent).toBe(false);
    expect(classifyMailError({ responseCode: 451, response: '451 later' }).permanent).toBe(false);
    expect(classifyMailError({ code: 'EAUTH', responseCode: 535, response: '535 bad credentials' }).permanent).toBe(false);
  });

  it('the diagnostic is one short line: code + server reply, no body', () => {
    const e = classifyMailError({ responseCode: 550, response: `550 5.1.1 rejected\nsecond line with details`.padEnd(400, 'x') });
    expect(e.message.startsWith('550: 550 5.1.1 rejected')).toBe(true);
    expect(e.message).not.toContain('\n');
    expect(e.message.length).toBeLessThanOrEqual(300);
  });
});
