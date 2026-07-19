/** Prediction card types (Section 2 / 11.3). */

export type CardChoice = "yes" | "no";
export type CardOutcome = "win" | "loss" | "void";

export type CardType =
  | "goal_in_window"
  | "next_shot_on_target"
  | "corner_before_minute"
  | "card_in_window"
  | "final_outcome";

export interface PredictionCard {
  id: string;
  fixtureId: string;
  cardType: CardType;
  question: string; // grade-8, no crypto vocabulary
  windowStartSeq: number;
  windowStartTs: number; // epoch ms, real match time the card was issued
  windowEndTs: number; // epoch ms, card expires here if unresolved
  basePoints: number;
  difficultyTier: 1 | 2 | 3 | 4 | 5;
  /** Which side this card is about, when the card type is participant-specific. */
  predicateParticipant?: 1 | 2;
  /** For corner_before_minute: target match-clock minute. */
  targetMinute?: number;
}
