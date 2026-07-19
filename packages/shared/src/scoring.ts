import type { CardOutcome } from "./cards";

/**
 * Base points by difficulty tier (Section 2: "longer windows are easier and
 * pay less. Short windows and rare events pay more"). Tuning these is a
 * product decision, not a technical one — treat as a starting curve.
 */
export const DIFFICULTY_BASE_POINTS: Record<1 | 2 | 3 | 4 | 5, number> = {
  1: 50,
  2: 75,
  3: 100,
  4: 150,
  5: 250,
};

/**
 * Streak multiplier bands (Section 2: "x1, x1.2, x1.5, x2, x3..."). Streak
 * is consecutive correct calls, checked BEFORE the current call's outcome
 * is applied — i.e. call #1 of a fresh streak still pays x1.
 */
export function streakMultiplier(streak: number): number {
  if (streak >= 10) return 3;
  if (streak >= 7) return 2;
  if (streak >= 5) return 1.5;
  if (streak >= 3) return 1.2;
  return 1;
}

export function computeAwardedPoints(basePoints: number, multiplier: number): number {
  return Math.round(basePoints * multiplier);
}

/**
 * A missed call always resets to 0 — CLAUDE.md Section 2: "never punish
 * harshly," but the streak itself IS the loss-aversion hook, so it still
 * has to actually break.
 */
export function nextStreak(currentStreak: number, outcome: CardOutcome): number {
  if (outcome === "win") return currentStreak + 1;
  if (outcome === "loss") return 0;
  return currentStreak; // void: card never really happened, streak untouched
}

/** Encouraging lines for a miss (Section 17: never a harsh failure state). */
export const ENCOURAGEMENT_LINES = [
  "So close. Next one.",
  "The game had other plans.",
  "Still in it. Call the next one.",
  "That one got away. Here comes another.",
];

export function pickEncouragementLine(seed: number): string {
  return ENCOURAGEMENT_LINES[seed % ENCOURAGEMENT_LINES.length];
}
