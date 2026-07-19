import type { CardOutcome, PredictionCard } from "./cards";
import type { NormalizedMatchEvent } from "./txline";

/** Messages the relay's WebSocket fanout sends to clients (Section 5). */
export type RelayMessage =
  | { type: "match_event"; mode: "replay" | "live"; payload: NormalizedMatchEvent }
  | { type: "card_issued"; payload: PredictionCard }
  | { type: "card_resolved"; payload: { cardId: string; outcome: CardOutcome; resolvedSeq: number } }
  | { type: "replay_starting"; fixtureId: string }
  | { type: "replay_complete" };
