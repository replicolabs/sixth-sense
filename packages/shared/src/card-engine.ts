import type { CardOutcome, CardType, PredictionCard } from "./cards";
import { DIFFICULTY_BASE_POINTS } from "./scoring";
import type { MatchState } from "./match-state";
import type { NormalizedMatchEvent, PossibleData, ShotData } from "./txline";

export interface CardEngineOptions {
  /** Minimum real ms between cards — never spam the user. */
  minGapMs?: number;
  /** If nothing more interesting happens, force a card by this long (Section 2: "never leave the user waiting"). */
  maxGapMs?: number;
}

export interface CardEngineState {
  lastCardIssuedTs: number | null;
  cardCounter: number;
}

export function initCardEngineState(): CardEngineState {
  return { lastCardIssuedTs: null, cardCounter: 0 };
}

function isPossibleHint(update: NormalizedMatchEvent["update"]): PossibleData | null {
  if (update.action !== "possible") return null;
  const data = update.data as PossibleData;
  return data.goal || data.corner || data.penalty || data.redCard ? data : null;
}

function formatWindow(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function buildCard(
  cardType: CardType,
  fixtureId: string,
  seq: number,
  nowTs: number,
  windowMs: number,
  difficultyTier: 1 | 2 | 3 | 4 | 5,
  cardCounter: number,
  extra: { targetMinute?: number; predicateParticipant?: 1 | 2 } = {},
): PredictionCard {
  const questionByType: Record<CardType, string> = {
    goal_in_window: `GOAL in the next ${formatWindow(windowMs)}?`,
    next_shot_on_target: "Will the next shot be on target?",
    corner_before_minute: `Corner before minute ${extra.targetMinute ?? "?"}?`,
    card_in_window: `A card shown in the next ${formatWindow(windowMs)}?`,
    final_outcome: "Will this end level?",
  };

  return {
    id: `${fixtureId}-${cardCounter}`,
    fixtureId,
    cardType,
    question: questionByType[cardType],
    windowStartSeq: seq,
    windowStartTs: nowTs,
    windowEndTs: nowTs + windowMs,
    basePoints: DIFFICULTY_BASE_POINTS[difficultyTier],
    difficultyTier,
    ...extra,
  };
}

/**
 * Call once per incoming event while no card is currently active. Returns
 * the next card to issue plus updated engine state, or null if it isn't
 * time yet. Timing per Section 2: a "possible" hint (ball in a dangerous
 * spot) issues a short, tense card immediately; otherwise a card is forced
 * every 30-90 real seconds so the user is never left with nothing to do.
 */
export function maybeGenerateCard(
  matchState: MatchState,
  engineState: CardEngineState,
  event: NormalizedMatchEvent,
  options: CardEngineOptions = {},
): { card: PredictionCard; engineState: CardEngineState } | null {
  const minGapMs = options.minGapMs ?? 30_000;
  const maxGapMs = options.maxGapMs ?? 90_000;
  const { update } = event;
  const fixtureId = event.fixtureInfo.fixtureId;

  const sinceLastCard =
    engineState.lastCardIssuedTs === null ? Infinity : update.ts - engineState.lastCardIssuedTs;
  if (sinceLastCard < minGapMs) return null;

  const hint = isPossibleHint(update);
  if (!hint && sinceLastCard < maxGapMs) return null;

  let card: PredictionCard;
  if (hint?.goal || hint?.penalty) {
    card = buildCard("goal_in_window", fixtureId, update.seq, update.ts, 90_000, 4, engineState.cardCounter);
  } else if (hint?.redCard) {
    card = buildCard("card_in_window", fixtureId, update.seq, update.ts, 90_000, 4, engineState.cardCounter);
  } else if (hint?.corner) {
    const targetMinute = Math.floor(update.clock.seconds / 60) + 2;
    card = buildCard(
      "corner_before_minute",
      fixtureId,
      update.seq,
      update.ts,
      120_000,
      3,
      engineState.cardCounter,
      { targetMinute },
    );
  } else if (matchState.possessionZone === "HighDanger" || matchState.possessionZone === "Danger") {
    // A shot is genuinely plausible soon — this is the "ball in a
    // dangerous attacking zone" moment Section 2 calls out as tense and
    // fun, not just a timing rotation.
    card = buildCard("next_shot_on_target", fixtureId, update.seq, update.ts, 45_000, 3, engineState.cardCounter);
  } else if (matchState.possessionZone === "Attack") {
    card = buildCard("goal_in_window", fixtureId, update.seq, update.ts, 120_000, 3, engineState.cardCounter);
  } else {
    // Genuinely calm right now (Safe possession or unknown) — a random
    // shot-window card here would be the "random card during a goal kick"
    // anti-pattern Section 2 warns against, so favor longer, lower-tension
    // windows that are honestly easier, and pay less accordingly.
    const rotation: CardType[] = ["goal_in_window", "corner_before_minute"];
    const cardType = rotation[engineState.cardCounter % rotation.length];
    if (cardType === "goal_in_window") {
      card = buildCard(cardType, fixtureId, update.seq, update.ts, 240_000, 1, engineState.cardCounter);
    } else {
      const targetMinute = Math.floor(update.clock.seconds / 60) + 5;
      card = buildCard(cardType, fixtureId, update.seq, update.ts, 300_000, 2, engineState.cardCounter, {
        targetMinute,
      });
    }
  }

  return {
    card,
    engineState: { lastCardIssuedTs: update.ts, cardCounter: engineState.cardCounter + 1 },
  };
}

/**
 * Given the active card and the newest event (matchState already folded
 * in), decides whether the card resolves now. Returns null if still
 * pending. Neutral (not team-specific) for goal_in_window/card_in_window,
 * matching CLAUDE.md's own example ("GOAL in the next 2:00? YES/NO").
 *
 * The returned outcome is OBJECTIVE, from a hypothetical "yes" caller's
 * perspective — "win" means the predicate came true (the goal happened,
 * the shot was on target, ...), "loss" means it didn't. This is the same
 * for every viewer regardless of what they personally picked (per
 * CLAUDE.md Section 5: the relay is authoritative and broadcasts one
 * shared result). A caller who picked "no" must flip it themselves:
 * personalOutcome = (choice === "yes" || outcome === "void") ? outcome
 *   : (outcome === "win" ? "loss" : "win").
 */
export function resolveCard(
  card: PredictionCard,
  matchState: MatchState,
  newEvent: NormalizedMatchEvent,
): CardOutcome | null {
  const { update } = newEvent;
  const windowExpired = update.ts > card.windowEndTs;

  switch (card.cardType) {
    case "goal_in_window": {
      if (update.action === "goal" && update.ts <= card.windowEndTs) return "win";
      if (windowExpired || update.action === "game_finalised") return "loss";
      return null;
    }
    case "next_shot_on_target": {
      // Every shot fires twice on the wire: an unconfirmed placeholder
      // with empty Data, then a confirmed one with the real Outcome
      // (verified against real match data). Resolving on the unconfirmed
      // one meant every shot defaulted to a loss via normalize.ts's
      // "OffTarget" fallback for missing Outcome — wait for confirmation.
      if (update.action === "shot" && update.confirmed) {
        return (update.data as ShotData).outcome === "OnTarget" ? "win" : "loss";
      }
      if (windowExpired || update.action === "game_finalised") return "loss";
      return null;
    }
    case "corner_before_minute": {
      const targetSeconds = (card.targetMinute ?? 0) * 60;
      if (update.action === "corner" && update.clock.seconds <= targetSeconds) return "win";
      if (update.clock.seconds > targetSeconds || update.action === "game_finalised") return "loss";
      return null;
    }
    case "card_in_window": {
      if ((update.action === "yellow_card" || update.action === "red_card") && update.ts <= card.windowEndTs) {
        return "win";
      }
      if (windowExpired || update.action === "game_finalised") return "loss";
      return null;
    }
    case "final_outcome": {
      if (update.action !== "game_finalised") return null;
      const p1 = matchState.score?.participant1.total.goals ?? 0;
      const p2 = matchState.score?.participant2.total.goals ?? 0;
      return p1 === p2 ? "win" : "loss";
    }
    default:
      return null;
  }
}

/**
 * Time-based expiry check, independent of waiting for the next event —
 * needed because a card can outlive the gap until the next real event
 * arrives. Callers estimate `currentMatchTs` from the last known event ts
 * plus elapsed wall time scaled by the replay acceleration factor (1 for
 * live mode).
 */
export function checkExpiry(card: PredictionCard, currentMatchTs: number): CardOutcome | null {
  return currentMatchTs > card.windowEndTs ? "loss" : null;
}
