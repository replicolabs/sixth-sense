import type { FixtureInfo, NormalizedMatchEvent, PossessionZone, ScoreByPeriod } from "./txline";

export interface MatchState {
  fixtureInfo: FixtureInfo;
  /** Cumulative totals, carried forward from the last event that included a Score payload. */
  score: {
    participant1: ScoreByPeriod;
    participant2: ScoreByPeriod;
  } | null;
  clockRunning: boolean;
  clockSeconds: number;
  possessionZone: PossessionZone | null;
  /** Which side (1 or 2) currently has the ball, when known. */
  possessionParticipant: 1 | 2 | null;
  lastSeq: number;
  lastTs: number;
  /** Bounded ring buffer for the event ticker (Section 11.3). */
  recentEvents: NormalizedMatchEvent[];
}

const MAX_RECENT_EVENTS = 30;

export function initMatchState(fixtureInfo: FixtureInfo): MatchState {
  return {
    fixtureInfo,
    score: null,
    clockRunning: false,
    clockSeconds: 0,
    possessionZone: null,
    possessionParticipant: null,
    lastSeq: 0,
    lastTs: 0,
    recentEvents: [],
  };
}

/**
 * Pure reducer: folds one normalized event into the running match state.
 * Used identically by the relay's card engine and the client's UI, so both
 * always agree on "what the match currently looks like."
 */
export function reduceMatchState(state: MatchState, event: NormalizedMatchEvent): MatchState {
  const { update } = event;
  const next: MatchState = {
    ...state,
    lastSeq: update.seq,
    lastTs: update.ts,
    clockRunning: update.clock.running,
    clockSeconds: update.clock.seconds,
  };

  if (update.score) {
    next.score = update.score;
  }

  if (update.possessionZone) {
    next.possessionZone = update.possessionZone;
  }
  if (update.possessionParticipant) {
    next.possessionParticipant = update.possessionParticipant;
  }

  next.recentEvents = [...state.recentEvents, event].slice(-MAX_RECENT_EVENTS);

  return next;
}
