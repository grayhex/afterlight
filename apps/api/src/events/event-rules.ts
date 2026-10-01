/**
 * Чистые правила переходов события раскрытия (docs/mvp-contract.md, раздел 5). Без БД и времени «снаружи»:
 * решение принимается по фактам события, подсчитанным голосам и переданному моменту `now`.
 */
export type EventState = 'Submitted' | 'Confirming' | 'Disputed' | 'Grace' | 'Finalized' | 'Rejected' | 'Cancelled';

export const ACTIVE_STATES: readonly EventState[] = ['Submitted', 'Confirming', 'Disputed', 'Grace'];
export const VOTING_STATES: readonly EventState[] = ['Submitted', 'Confirming'];
export const DISPUTE_LOCK_HOURS = 24;
const HOUR_MS = 3600 * 1000;

export interface EventFacts {
  state: EventState;
  quorumRequired: number;
  graceHours: number;
  graceUntil: Date | null;
  disputedUntil: Date | null;
}

export interface VoteTally {
  /** Голоса только действующих верификаторов из снимка состава */
  confirms: number;
  denies: number;
}

export type Transition =
  | { to: EventState; kind: 'none' }
  | { to: 'Disputed'; kind: 'dispute'; disputedUntil: Date }
  | { to: 'Grace'; kind: 'grace'; graceStartedAt: Date; graceUntil: Date }
  | { to: 'Finalized'; kind: 'finalize' }
  | { to: 'Rejected'; kind: 'reject' };

export const isActive = (s: EventState) => ACTIVE_STATES.includes(s);

/** Что делать с событием при данных голосах и моменте now. Терминальные состояния не меняются. */
export function evaluate(event: EventFacts, tally: VoteTally, now: Date): Transition {
  const { state } = event;

  if (state === 'Submitted' || state === 'Confirming') {
    if (tally.confirms > 0 && tally.denies > 0) {
      return { to: 'Disputed', kind: 'dispute', disputedUntil: new Date(now.getTime() + DISPUTE_LOCK_HOURS * HOUR_MS) };
    }
    if (tally.confirms >= event.quorumRequired) {
      // Полная отсрочка отсчитывается от момента достижения кворума, а не от создания события
      return { to: 'Grace', kind: 'grace', graceStartedAt: now, graceUntil: new Date(now.getTime() + event.graceHours * HOUR_MS) };
    }
    return { to: tally.confirms > 0 ? 'Confirming' : 'Submitted', kind: 'none' };
  }

  if (state === 'Grace') {
    // Время выхода из grace — приоритет: Deny, поданный после graceUntil, раскрытие уже не останавливает (D6 — только во время grace)
    if (event.graceUntil && now.getTime() >= event.graceUntil.getTime()) return { to: 'Finalized', kind: 'finalize' };
    if (tally.denies > 0) {
      return { to: 'Disputed', kind: 'dispute', disputedUntil: new Date(now.getTime() + DISPUTE_LOCK_HOURS * HOUR_MS) };
    }
    return { to: 'Grace', kind: 'none' };
  }

  if (state === 'Disputed') {
    if (event.disputedUntil && now.getTime() >= event.disputedUntil.getTime()) return { to: 'Rejected', kind: 'reject' };
    return { to: 'Disputed', kind: 'none' };
  }

  return { to: state, kind: 'none' };
}

/** Можно ли принять голос в данном состоянии и в данный момент. */
export function canVote(event: Pick<EventFacts, 'state' | 'graceUntil'>, decision: 'Confirm' | 'Deny', now: Date): boolean {
  if (VOTING_STATES.includes(event.state)) return true;
  // D6: во время grace допустим только Deny, и только до выхода из grace
  return event.state === 'Grace' && decision === 'Deny' && !!event.graceUntil && now.getTime() < event.graceUntil.getTime();
}
