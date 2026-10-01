import { describe, it, expect } from '@jest/globals';
import { evaluate, canVote, EventFacts } from '../../src/events/event-rules.js';

const H = 3600 * 1000;
const t0 = new Date('2026-01-01T00:00:00.000Z');
const at = (h: number) => new Date(t0.getTime() + h * H);
const base: EventFacts = { state: 'Submitted', quorumRequired: 2, graceHours: 24, graceUntil: null, disputedUntil: null };

describe('event state rules', () => {
  it('stays Submitted/Confirming below the quorum', () => {
    expect(evaluate(base, { confirms: 0, denies: 0 }, t0)).toMatchObject({ to: 'Submitted', kind: 'none' });
    expect(evaluate(base, { confirms: 1, denies: 0 }, t0)).toMatchObject({ to: 'Confirming', kind: 'none' });
    expect(evaluate(base, { confirms: 0, denies: 3 }, t0)).toMatchObject({ to: 'Submitted', kind: 'none' }); // Deny без Confirm — не спор
  });

  it('starts the full grace at the moment of the quorum, not at event creation', () => {
    const t = evaluate({ ...base, state: 'Confirming' }, { confirms: 2, denies: 0 }, at(100));
    expect(t).toMatchObject({ to: 'Grace', kind: 'grace' });
    if (t.kind === 'grace') {
      expect(t.graceStartedAt).toEqual(at(100));
      expect(t.graceUntil).toEqual(at(124));
    }
  });

  it('uses the snapshotted grace length', () => {
    const t = evaluate({ ...base, graceHours: 6 }, { confirms: 2, denies: 0 }, t0);
    expect(t.kind === 'grace' && t.graceUntil).toEqual(at(6));
  });

  it('Confirm and Deny together make a 24h dispute', () => {
    const t = evaluate(base, { confirms: 1, denies: 1 }, at(5));
    expect(t).toMatchObject({ to: 'Disputed', kind: 'dispute' });
    if (t.kind === 'dispute') expect(t.disputedUntil).toEqual(at(29));
  });

  it('finalizes only at or after graceUntil', () => {
    const grace: EventFacts = { ...base, state: 'Grace', graceUntil: at(24) };
    expect(evaluate(grace, { confirms: 2, denies: 0 }, at(23.999))).toMatchObject({ to: 'Grace', kind: 'none' });
    expect(evaluate(grace, { confirms: 2, denies: 0 }, at(24))).toMatchObject({ to: 'Finalized', kind: 'finalize' });
    expect(evaluate(grace, { confirms: 2, denies: 0 }, at(500))).toMatchObject({ to: 'Finalized', kind: 'finalize' });
  });

  it('Deny during grace disputes, but the deadline wins over a late Deny (D6)', () => {
    const grace: EventFacts = { ...base, state: 'Grace', graceUntil: at(24) };
    expect(evaluate(grace, { confirms: 1, denies: 1 }, at(10))).toMatchObject({ to: 'Disputed', kind: 'dispute' });
    expect(evaluate(grace, { confirms: 1, denies: 1 }, at(24))).toMatchObject({ to: 'Finalized', kind: 'finalize' });
  });

  it('closes a dispute only after the lock expires', () => {
    const d: EventFacts = { ...base, state: 'Disputed', disputedUntil: at(24) };
    expect(evaluate(d, { confirms: 1, denies: 1 }, at(23))).toMatchObject({ to: 'Disputed', kind: 'none' });
    expect(evaluate(d, { confirms: 1, denies: 1 }, at(24))).toMatchObject({ to: 'Rejected', kind: 'reject' });
  });

  it('terminal states never change', () => {
    for (const state of ['Finalized', 'Rejected', 'Cancelled'] as const) {
      expect(evaluate({ ...base, state }, { confirms: 9, denies: 9 }, at(999))).toMatchObject({ to: state, kind: 'none' });
    }
  });

  it('allows votes only in Submitted/Confirming, plus Deny during grace before the deadline', () => {
    expect(canVote({ state: 'Submitted', graceUntil: null }, 'Confirm', t0)).toBe(true);
    expect(canVote({ state: 'Confirming', graceUntil: null }, 'Deny', t0)).toBe(true);
    const g = { state: 'Grace' as const, graceUntil: at(24) };
    expect(canVote(g, 'Deny', at(1))).toBe(true);
    expect(canVote(g, 'Confirm', at(1))).toBe(false);
    expect(canVote(g, 'Deny', at(24))).toBe(false);
    for (const state of ['Disputed', 'Finalized', 'Rejected', 'Cancelled'] as const) {
      expect(canVote({ state, graceUntil: null }, 'Deny', t0)).toBe(false);
    }
  });
});
