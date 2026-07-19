/**
 * Normalized (camelCase) TxLINE shapes. Raw TxLINE payloads are inconsistently
 * cased (PascalCase vs camelCase) across endpoints — packages/txline is the
 * only place allowed to see the raw shape. Everything downstream sees this.
 */

export type SolanaCluster = "devnet" | "mainnet-beta";

export type TxLineAction =
  | "goal"
  | "shot"
  | "corner"
  | "yellowCard"
  | "redCard"
  | "penalty"
  | "var"
  | "substitution"
  | "possible"
  | "possession"
  | "game_finalised"
  | (string & {});

export interface FixtureInfo {
  fixtureId: string;
  participant1: string;
  participant2: string;
  participant1Id: string;
  participant2Id: string;
  participant1IsHome: boolean;
  competition: string;
  competitionId: string;
  startTime: string; // ISO-8601
  sportId: number; // 6 = soccer
}

export interface PeriodStatLine {
  goals: number;
  corners: number;
  yellowCards: number;
  redCards: number;
}

export interface ScoreByPeriod {
  total: PeriodStatLine;
  h1: PeriodStatLine;
  h2: PeriodStatLine;
  ht: PeriodStatLine;
  et1: PeriodStatLine;
  et2: PeriodStatLine;
  etTotal: PeriodStatLine;
  pe: PeriodStatLine;
}

export interface MatchClock {
  running: boolean;
  seconds: number;
}

// Confirmed against a real /api/scores/historical response (fixtureId
// 18237038): the wire value is "OwnGoal", not "Own".
export type GoalType = "Shot" | "Head" | "OwnGoal" | "Other";
// Real wire values seen (same fixture): OnTarget, OffTarget, Blocked,
// OnPitch, OffPitch. "Woodwork" is CLAUDE.md's claim, not yet observed —
// keeping it since normalize.ts passes through whatever string arrives
// rather than coercing, so an unseen value won't get silently mangled.
export type ShotOutcome = "OnTarget" | "OffTarget" | "Woodwork" | "Blocked" | "OnPitch" | "OffPitch" | (string & {});
export type PossessionZone = "Safe" | "Attack" | "Danger" | "HighDanger";

export interface GoalData {
  playerId?: string;
  goalType: GoalType;
}

export interface ShotData {
  playerId?: string;
  outcome: ShotOutcome;
}

export interface PossibleData {
  corner?: boolean;
  goal?: boolean;
  penalty?: boolean;
  redCard?: boolean;
  yellowCard?: boolean;
  var?: boolean;
}

export interface PossessionData {
  zone: PossessionZone;
}

export interface MatchUpdate {
  action: TxLineAction;
  seq: number; // per-fixture, starts at 1
  /**
   * Mapped from the raw `Id` field — the real Scores schema has no field
   * literally named `globalSeq`. Observed to differ from `seq` (e.g. Id=905
   * vs Seq=1026 on the same event), consistent with Id being a separate,
   * likely cross-fixture counter, but that's inferred from one fixture's
   * data, not confirmed from documentation.
   */
  globalSeq: number;
  ts: number; // epoch ms
  /**
   * Plain integer game-phase code (values observed: 2, 4, 100 for
   * game_finalised). An earlier draft of this file changed this to a
   * string status code based on the OpenAPI spec's SoccerFixtureStatus
   * schema — that turned out not to match reality: real
   * /api/scores/historical responses carry StatusId as a number, with no
   * separate string-coded field. Reverted after checking an actual
   * response.
   */
  statusId: number;
  data: GoalData | ShotData | PossibleData | PossessionData | Record<string, unknown>;
  score?: {
    participant1: ScoreByPeriod;
    participant2: ScoreByPeriod;
  };
  confirmed: boolean;
  clock: MatchClock;
  /** Which side this specific event is about (e.g. who took the shot). */
  participant?: 1 | 2;
  /**
   * Possession fields appear on the raw envelope across many action types
   * (goal, shot, corner, var, ...), not only on a dedicated "possession"
   * action — promoted to top-level here rather than buried in `data` so
   * the card engine and momentum strip (Section 11.3) can read them off
   * any event, not just possession-specific ones.
   */
  possessionZone?: PossessionZone;
  possessionParticipant?: 1 | 2;
}

export interface NormalizedMatchEvent {
  fixtureInfo: FixtureInfo;
  update: MatchUpdate;
}

/**
 * Game is fully over: regulation, extra time, penalties, or abandonment.
 * Confirmed against a real finished fixture: the `game_finalised` action
 * co-occurs with `statusId === 100`.
 */
export function isFinalised(update: MatchUpdate): boolean {
  return update.action === "game_finalised" && update.statusId === 100;
}

/**
 * Deterministic TxLINE stat keys (Section 6.6). Period prefixes: 1000=H1,
 * 2000=HT, 3000=H2, 4000=ET1, etc. e.g. 3001 = participant 1 second-half goals.
 */
export const STAT_KEYS = {
  PARTICIPANT_1_GOALS: 1,
  PARTICIPANT_2_GOALS: 2,
  PARTICIPANT_1_CORNERS: 7,
  PARTICIPANT_2_CORNERS: 8,
  PARTICIPANT_1_RED_CARDS: 5,
  PARTICIPANT_2_RED_CARDS: 6,
} as const;

export const PERIOD_PREFIX = {
  H1: 1000,
  HT: 2000,
  H2: 3000,
  ET1: 4000,
} as const;

export interface StatProofNode {
  hash: string;
  isRightSibling: boolean;
}

export interface StatValidationProof {
  summary: Record<string, unknown>;
  subTreeProof: StatProofNode[];
  mainTreeProof: StatProofNode[];
  eventStatRoot: string;
  statToProve: string;
  statProof: StatProofNode[];
}
