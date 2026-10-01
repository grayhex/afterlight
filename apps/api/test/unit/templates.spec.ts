import { describe, it, expect } from '@jest/globals';
import { eventMessages, formatUtc, templates } from '../../src/notifications/templates.js';

describe('email templates', () => {
  it('formats a moment in UTC without seconds', () => {
    expect(formatUtc(new Date('2026-10-02T09:05:59.000Z'))).toBe('02.10.2026 09:05 UTC');
    expect(formatUtc(new Date('2026-12-31T23:59:00.000Z'))).toBe('31.12.2026 23:59 UTC');
  });

  it('puts one-time tokens into the link fragment, never into the query', () => {
    for (const [mail, path] of [
      [templates.passwordReset('abc123'), '/reset-password'],
      [templates.emailVerification('abc123'), '/verify-email'],
      [templates.verifierInvitation('abc123'), '/invite'],
    ] as const) {
      expect(mail.text).toContain(`${path}#token=abc123`);
      expect(mail.text).not.toMatch(/\?[^ ]*token=/);
    }
  });

  it('event mails give each side its own text, show the grace deadline readably and never mention content or keys', () => {
    const until = new Date('2026-10-02T09:30:00.000Z');
    const all = [eventMessages.started(), eventMessages.disputed(), eventMessages.grace(until), eventMessages.finalized(), eventMessages.rejected(), eventMessages.cancelled()];
    for (const m of all) {
      for (const side of [m.owner, m.verifiers]) {
        expect(side.subject).toMatch(/^AfterLight: /);
        expect(side.text.length).toBeGreaterThan(20);
        expect(side.text).not.toMatch(/example\.(com|org|net)|[0-9a-f]{32}|T\d\d:\d\d:\d\d/i);
      }
    }
    const grace = eventMessages.grace(until);
    expect(grace.owner.text).toContain('02.10.2026 09:30 UTC');
    expect(grace.verifiers.text).toContain('02.10.2026 09:30 UTC');
    expect(grace.owner.text).toMatch(/Я жив/);
    // верификатору не предлагают отменять: это действие владельца
    expect(grace.verifiers.text).not.toMatch(/Я жив/);
  });

  it('the finalization mail does not promise a content handover that the system does not perform yet', () => {
    const { owner, verifiers } = eventMessages.finalized();
    expect(owner.text).toMatch(/не выполняется/);
    expect(owner.text).toMatch(/получатель этим письмом не уведомляется/);
    expect(owner.text).not.toMatch(/уведомляется отдельно/);
    expect(verifiers.text).toMatch(/не передаётся/);
  });
});
