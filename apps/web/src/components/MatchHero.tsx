"use client";

import type { MatchState } from "@sixth-sense/shared";
import { TeamFlag } from "./TeamFlag";
import { LiveTag } from "./ui/LiveTag";

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Section 11.3 match hero: dark glass over a pitch-feel background.
 * Liveness reads through the ticking clock and a slow ambient breathing
 * glow (Section 10.5) — never a pulsing dot.
 */
export function MatchHero({ matchState }: { matchState: MatchState }) {
  const p1Goals = matchState.score?.participant1.total.goals ?? 0;
  const p2Goals = matchState.score?.participant2.total.goals ?? 0;

  return (
    <div className="relative overflow-hidden rounded-[var(--r-xl)]">
      {/*
        The breathing animation lives on its own absolute layer behind the
        glass, not on the card as a whole — Section 10.5 wants the ambient
        BACKGROUND glow to breathe, not the readable content to fade in
        and out with it.
      */}
      <div className="pitch-backdrop breathing absolute inset-0" />
      <div className="glass-panel-dark relative rounded-[var(--r-xl)] p-6 text-[var(--cream)]">
        {matchState.clockRunning && (
          <div className="absolute right-4 top-4">
            <LiveTag />
          </div>
        )}

        {/*
          Fixed grid tracks, not flex `justify-between` — flex siblings
          renegotiate width against each other as content changes, which is
          what caused the "squeeze" reported during play-testing. Grid
          columns don't do that: the two name columns are always equal
          width and the score column always sized to its own content.
        */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="flex min-w-0 items-center gap-1.5 text-lg font-semibold" title={matchState.fixtureInfo.participant1}>
            <TeamFlag teamId={matchState.fixtureInfo.participant1Id} teamName={matchState.fixtureInfo.participant1} />
            <span className="min-w-0 truncate">{matchState.fixtureInfo.participant1}</span>
          </span>
          <span className="font-[family-name:var(--font-display)] whitespace-nowrap text-[3.25rem] font-extrabold leading-none tracking-[-0.01em]">
            {p1Goals}–{p2Goals}
          </span>
          <span
            className="flex min-w-0 items-center justify-end gap-1.5 text-right text-lg font-semibold"
            title={matchState.fixtureInfo.participant2}
          >
            <span className="min-w-0 truncate">{matchState.fixtureInfo.participant2}</span>
            <TeamFlag teamId={matchState.fixtureInfo.participant2Id} teamName={matchState.fixtureInfo.participant2} />
          </span>
        </div>

        <div className="mt-2 flex items-center justify-center">
          <span className="font-[family-name:var(--font-mono)] text-sm tabular-nums text-[var(--volt-400)]">
            {formatClock(matchState.clockSeconds)}
          </span>
        </div>
      </div>
    </div>
  );
}
