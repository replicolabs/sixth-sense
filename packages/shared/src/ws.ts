import type { CardOutcome, PredictionCard } from "./cards";
import type { NormalizedMatchEvent } from "./txline";

/** Messages the relay's WebSocket fanout sends to clients (Section 5). */
export type RelayMessage =
  | { type: "match_event"; mode: "replay" | "live"; payload: NormalizedMatchEvent }
  | { type: "card_issued"; payload: PredictionCard }
  | { type: "card_resolved"; payload: { cardId: string; outcome: CardOutcome; resolvedSeq: number } }
  | { type: "replay_starting"; fixtureId: string }
  | { type: "replay_complete" }
  /**
   * On-demand live channels (a user picking a real live match from the
   * home screen, not the boot-time shared broadcast): the match a user
   * picked hasn't kicked off yet, or the live channel couldn't start at
   * all (bad fixtureId, TxLINE error). Distinct from "replay_starting" /
   * "replay_complete" since a live channel has no cached data to fall
   * back on while waiting.
   */
  | { type: "live_pending"; fixtureId: string; startTime: string }
  | { type: "live_error"; fixtureId: string; message: string };
