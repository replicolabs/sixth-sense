"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/store/gameStore";
import type { PredictionCard } from "@sixth-sense/shared";

/**
 * Ticks smoothly between discrete event arrivals by estimating "current
 * match time" from wall-clock elapsed time and the known replay
 * acceleration factor (1 for live mode) — not styled to the full liquid
 * glass spec yet (Phase 4), just needs to visibly drain.
 */
export function CountdownRing({ card, size = 64 }: { card: PredictionCard; size?: number }) {
  const estimateCurrentMatchTs = useGameStore((s) => s.estimateCurrentMatchTs);
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    const totalMs = card.windowEndTs - card.windowStartTs;
    const tick = () => {
      const now = estimateCurrentMatchTs();
      const remaining = card.windowEndTs - now;
      setFraction(Math.min(1, Math.max(0, 1 - remaining / totalMs)));
    };
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [card, estimateCurrentMatchTs]);

  const radius = size / 2 - 4;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * fraction;
  // Last quarter of the window gets the loss color and a glow — the ring
  // draining fast is already tense, this just makes "almost out of time"
  // unambiguous at a glance.
  const urgent = fraction > 0.75;
  const ringColor = urgent ? "var(--loss)" : "var(--volt-500)";

  return (
    <svg
      width={size}
      height={size}
      className="-rotate-90"
      style={urgent ? { filter: `drop-shadow(0 0 4px ${ringColor})` } : undefined}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--hairline)"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: "stroke 0.3s ease" }}
      />
    </svg>
  );
}
