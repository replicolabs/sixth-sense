import type {
  FixtureInfo,
  GoalData,
  MatchUpdate,
  NormalizedMatchEvent,
  PossessionZone,
  ShotData,
} from "@sixth-sense/shared";
import type {
  RawFixtureSnapshotItem,
  RawPossessionType,
  RawScoresEvent,
  RawSoccerTotalScore,
} from "./raw";

export function normalizeFixtureSnapshot(raw: RawFixtureSnapshotItem): FixtureInfo {
  return {
    fixtureId: String(raw.FixtureId),
    participant1: raw.Participant1,
    participant2: raw.Participant2,
    participant1Id: String(raw.Participant1Id),
    participant2Id: String(raw.Participant2Id),
    participant1IsHome: raw.Participant1IsHome,
    competition: raw.Competition,
    competitionId: String(raw.CompetitionId),
    // StartTime is epoch MILLISECONDS on the wire, not seconds — confirmed
    // by fetching real fixtures/snapshot data (a naive *1000 here produced
    // year-58000+ dates).
    startTime: new Date(raw.StartTime).toISOString(),
    sportId: 6,
  };
}

const POSSESSION_ZONE_MAP: Record<RawPossessionType, PossessionZone> = {
  SafePossession: "Safe",
  AttackPossession: "Attack",
  DangerPossession: "Danger",
  HighDangerPossession: "HighDanger",
};

function normalizeActionData(raw: RawScoresEvent): MatchUpdate["data"] {
  const data = raw.Data ?? {};
  switch (raw.Action) {
    case "goal": {
      const d: GoalData = {
        playerId: data.PlayerId !== undefined ? String(data.PlayerId) : undefined,
        goalType: data.GoalType ?? "Other",
      };
      return d;
    }
    case "shot": {
      const d: ShotData = {
        playerId: data.PlayerId !== undefined ? String(data.PlayerId) : undefined,
        // Wire outcomes seen beyond CLAUDE.md's four (OnPitch/OffPitch for
        // e.g. deflections) are passed through as-is rather than coerced.
        outcome: (data.Outcome as ShotData["outcome"]) ?? "OffTarget",
      };
      return d;
    }
    case "possible":
      // Data carries whichever flags apply to this specific notification
      // directly — either the per-participant trio or the neutral trio.
      // Passing all of them through covers both without needing to join
      // against Parti1State/Parti2State/PossibleEvent.
      return {
        corner: data.Corner,
        goal: data.Goal,
        penalty: data.Penalty,
        redCard: data.RedCard,
        yellowCard: data.YellowCard,
        var: data.VAR,
      };
    default:
      return data as Record<string, unknown>;
  }
}

function normalizeScore(raw: RawScoresEvent): MatchUpdate["score"] | undefined {
  if (!raw.Score) return undefined;
  const line = (l: { Goals?: number; Corners?: number; YellowCards?: number; RedCards?: number } | undefined) => ({
    goals: l?.Goals ?? 0,
    corners: l?.Corners ?? 0,
    yellowCards: l?.YellowCards ?? 0,
    redCards: l?.RedCards ?? 0,
  });
  const total = (t: RawSoccerTotalScore | undefined) => ({
    total: line(t?.Total),
    h1: line(t?.H1),
    h2: line(t?.H2),
    ht: line(t?.HT),
    et1: line(t?.ET1),
    et2: line(t?.ET2),
    etTotal: line(t?.ETTotal),
    pe: line(t?.PE),
  });
  return {
    participant1: total(raw.Score.Participant1),
    participant2: total(raw.Score.Participant2),
  };
}

/**
 * Maps one raw `Scores` wire event (see raw.ts) plus its already-fetched
 * fixture metadata (from /api/fixtures/snapshot, joined by fixtureId) into
 * the clean shape the rest of the app consumes. This is the ONLY function
 * in the codebase allowed to read RawScoresEvent — everything downstream
 * uses NormalizedMatchEvent.
 */
export function normalizeScoresEvent(
  raw: RawScoresEvent,
  fixtureInfo: FixtureInfo,
): NormalizedMatchEvent {
  const update: MatchUpdate = {
    action: raw.Action,
    seq: raw.Seq,
    globalSeq: raw.Id,
    ts: raw.Ts,
    statusId: raw.StatusId ?? 0,
    data: normalizeActionData(raw),
    score: normalizeScore(raw),
    confirmed: raw.Confirmed ?? false,
    clock: raw.Clock ? { running: raw.Clock.Running, seconds: raw.Clock.Seconds } : { running: false, seconds: 0 },
    participant: raw.Participant === 1 || raw.Participant === 2 ? raw.Participant : undefined,
    // Present on the raw envelope across many action types, not just a
    // dedicated "possession" action — read universally rather than gated
    // on raw.Action.
    possessionZone: raw.PossessionType ? POSSESSION_ZONE_MAP[raw.PossessionType] : undefined,
    possessionParticipant:
      raw.Possession === 1 || raw.Possession === 2 ? raw.Possession : undefined,
  };
  return { fixtureInfo, update };
}
