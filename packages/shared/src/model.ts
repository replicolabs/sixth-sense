/**
 * Data model (Section 7). User/MatchSession/Prediction/Avatar/KitUnlock
 * are real Prisma models now (packages/db/prisma/schema.prisma) — import
 * those generated types directly rather than hand-duplicating them here,
 * since a hand-written copy just drifts out of sync with the real schema
 * (this file used to carry stale copies that had already gone stale
 * before ever being used anywhere).
 *
 * What's left here are shapes that are NOT a stored table: derived/query
 * results, not rows.
 */

/** CLAUDE.md Section 7: "derived/materialized," never a stored table. */
export interface LeaderboardRow {
  userId: string;
  nickname: string;
  points: number;
  bestStreak: number;
  rank: number;
}
