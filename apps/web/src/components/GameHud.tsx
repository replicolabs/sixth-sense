"use client";

import { PointsCounter } from "./ui/PointsCounter";
import { StreakFlame } from "./ui/StreakFlame";

/** Section 11.3 streak + points HUD, using the shared flame/odometer primitives. */
export function GameHud({
  streak,
  bestStreak,
  points,
}: {
  streak: number;
  bestStreak: number;
  points: number;
}) {
  return (
    // Three EQUAL grid columns, each centered — not flex with mixed
    // left/right alignment. That mix was why the numbers didn't line up
    // under their labels, and equal columns mean a value going from "0" to
    // "1250" never shifts anything else in the row.
    <div className="glass-panel grid grid-cols-3 rounded-[var(--r-lg)] px-5 py-3">
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-500)]">Streak</p>
        <div className="flex items-center gap-1.5">
          <StreakFlame streak={streak} />
          <span className="font-[family-name:var(--font-mono)] text-xl font-semibold tabular-nums text-[var(--ink-900)]">
            {streak}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-500)]">Points</p>
        <PointsCounter
          value={points}
          className="text-xl font-semibold text-[var(--ink-900)]"
        />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <p className="text-xs uppercase tracking-wide text-[var(--ink-500)]">Best streak</p>
        <span className="font-[family-name:var(--font-mono)] text-xl font-semibold tabular-nums text-[var(--ink-500)]">
          {bestStreak}
        </span>
      </div>
    </div>
  );
}
