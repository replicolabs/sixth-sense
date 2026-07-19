/**
 * Raw TxLINE wire shapes.
 *
 * Ground truth here comes from an ACTUAL /api/scores/historical response
 * fetched against devnet for a real, finished World Cup fixture (France vs
 * Spain, fixtureId 18237038) on 2026-07-18 — not from the OpenAPI spec,
 * which turned out to describe a different (and wrong) casing for this
 * endpoint. Concretely, disagreements found:
 *
 * - The OpenAPI "Scores" schema claims camelCase envelope fields
 *   (fixtureId, action, ts, seq, statusId as a SoccerFixtureStatus string
 *   enum, ...). The real wire data is PascalCase throughout, including the
 *   envelope: FixtureId, Action, Ts, Seq, StatusId (a plain NUMBER, not a
 *   string status code), Clock (itself {Running, Seconds} PascalCase),
 *   Score, Data, Stats, Participant, Possession, PossessionType,
 *   Parti1State, Parti2State, PossibleEvent, Kickoff.
 * - There is no "ScoreSoccer"/"DataSoccer"/"PossibleEventSoccer" nesting —
 *   just Score / Data / PossibleEvent directly (sport-specific naming
 *   doesn't appear at this level; "Type":"Soccer" is a separate field).
 * - PossessionType values are the FULL schema names — "SafePossession",
 *   "AttackPossession", "DangerPossession", "HighDangerPossession" — not
 *   the short "Safe"/"Attack"/... the docs implied.
 * - Response transport is SSE (`content-type: text/event-stream`), framed
 *   as `data: {...}\nid: <n>\n\n` per event, even for the "historical"
 *   endpoint — not a plain JSON array as the OpenAPI spec's response body
 *   claimed. See parseSseEvents in client.ts.
 * - `Data` for a "possible" action carries whichever flags are relevant to
 *   THAT notification directly — either {Corner,Goal,Penalty} or
 *   {RedCard,YellowCard,VAR} — rather than requiring a join against
 *   Parti1State/Parti2State/PossibleEvent (those fields do also appear,
 *   seemingly as redundant state snapshots, but Data alone is sufficient
 *   and simpler to normalize from).
 * - Score period objects (H1/HT/H2/ET1/ET2/PE/ETTotal/Total) are SPARSE:
 *   only fields that changed/are nonzero-relevant appear, e.g.
 *   {"YellowCards":1,"Corners":3} with no "Goals" key at all.
 *
 * We only model the soccer (SportId === 6 in fixtures/snapshot, but
 * "Type":"Soccer" / historical SportId seen as 1 in this feed — the schema
 * is shared across sports and the sport tag itself is inconsistent between
 * endpoints, so don't assume a single canonical sportId) fields we
 * actually use. Do not assume other sports' fields match this shape.
 */

export interface RawFixtureSnapshotItem {
  Ts: number;
  StartTime: number;
  Competition: string;
  CompetitionId: number;
  FixtureGroupId: number;
  Participant1Id: number;
  Participant1: string;
  Participant2Id: number;
  Participant2: string;
  FixtureId: number;
  Participant1IsHome: boolean;
}

/** Sparse — only fields that apply to this period appear. */
export interface RawSoccerScoreLine {
  Goals?: number;
  YellowCards?: number;
  RedCards?: number;
  Corners?: number;
}

export interface RawSoccerTotalScore {
  H1?: RawSoccerScoreLine;
  HT?: RawSoccerScoreLine;
  H2?: RawSoccerScoreLine;
  ET1?: RawSoccerScoreLine;
  ET2?: RawSoccerScoreLine;
  PE?: RawSoccerScoreLine;
  ETTotal?: RawSoccerScoreLine;
  Total?: RawSoccerScoreLine;
}

export interface RawScore {
  Participant1?: RawSoccerTotalScore;
  Participant2?: RawSoccerTotalScore;
}

/** GoalType/Outcome are Rust unit-variant enums that serialize as plain strings. */
export interface RawActionData {
  GoalType?: "Shot" | "Head" | "OwnGoal" | "Other";
  Outcome?: string; // seen: OnTarget, OffTarget, Blocked, OnPitch, OffPitch, Woodwork
  PlayerId?: number;
  PlayerInId?: number;
  PlayerOutId?: number;
  Participant?: number;
  // "possible" action data — either the per-participant trio or the
  // neutral trio can appear, never both at once in what we've observed.
  Corner?: boolean;
  Goal?: boolean;
  Penalty?: boolean;
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
}

export interface RawPossiblePartiEvent {
  Goal?: boolean;
  Penalty?: boolean;
  Corner?: boolean;
}

export interface RawPartiState {
  PossibleEvent?: RawPossiblePartiEvent;
}

/** Neutral possible-event flags, top-level (not tied to either participant). */
export interface RawNeutralPossibleEvent {
  RedCard?: boolean;
  YellowCard?: boolean;
  VAR?: boolean;
}

export type RawPossessionType =
  | "SafePossession"
  | "AttackPossession"
  | "DangerPossession"
  | "HighDangerPossession";

export interface RawClock {
  Running: boolean;
  Seconds: number;
}

export interface RawKickoff {
  Team?: number;
}

/** The flat `Scores` schema — one raw event, straight off the SSE wire. */
export interface RawScoresEvent {
  FixtureId: number;
  GameState: string;
  StartTime: number;
  IsTeam?: boolean;
  FixtureGroupId: number;
  CompetitionId: number;
  CountryId: number;
  SportId: number;
  Participant1IsHome: boolean;
  Participant2Id: number;
  Participant1Id: number;
  CoverageSecondaryData?: boolean;
  CoverageType?: string;
  Action: string;
  Id: number;
  Ts: number;
  ConnectionId: number;
  Seq: number;
  StatusId?: number;
  Type?: string;
  Confirmed?: boolean;
  Clock?: RawClock;
  Score?: RawScore;
  Data?: RawActionData;
  /** Flat map of stat key (string) -> value, e.g. "1" -> participant1 total goals. */
  Stats?: Record<string, number>;
  Participant?: number;
  Possession?: number;
  PossessionType?: RawPossessionType;
  PossibleEvent?: RawNeutralPossibleEvent;
  Parti1State?: RawPartiState;
  Parti2State?: RawPartiState;
  Kickoff?: RawKickoff;
}

/**
 * `hash` (and eventStatRoot/eventStatsSubTreeRoot below) are JSON arrays of
 * numbers on the wire (e.g. `[45,175,95,...]`, 32 entries) — NOT a hex or
 * base64 string as the OpenAPI spec's `format: binary` implied. Confirmed
 * by fetching a real /api/scores/stat-validation response.
 */
export interface RawProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export interface RawScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface RawScoresUpdateStats {
  updateCount: number;
  minTimestamp: number;
  maxTimestamp: number;
}

export interface RawScoresBatchSummary {
  fixtureId: number;
  updateStats: RawScoresUpdateStats;
  eventStatsSubTreeRoot: number[];
}

/** V1 (legacy) shape — query with statKey / statKey2. */
export interface RawStatValidationV1 {
  ts: number;
  statToProve: RawScoreStat;
  eventStatRoot: number[];
  summary: RawScoresBatchSummary;
  statProof: RawProofNode[];
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
  statToProve2?: RawScoreStat;
  statProof2?: RawProofNode[];
}

/** V2 shape — query with statKeys (comma-separated). Confirmed real shape. */
export interface RawStatValidationV2 {
  ts: number;
  statsToProve: RawScoreStat[];
  eventStatRoot: number[];
  summary: RawScoresBatchSummary;
  statProofs: RawProofNode[][];
  subTreeProof: RawProofNode[];
  mainTreeProof: RawProofNode[];
}

export type RawStatValidation = RawStatValidationV1;
