"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect } from "react";
import { useGameStore } from "@/store/gameStore";

const PARTICLE_COUNT = 14;

/** Deterministic per-index spread so particles don't reshuffle on re-render. */
function particleOffset(i: number) {
  const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
  const radius = 60 + (i % 3) * 20;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/**
 * CLAUDE.md Section 11.4: "an occasional larger celebration for milestone
 * streaks (streak of 5, 10) with a full-width glass banner and gold
 * particles" — distinct from the normal per-card win pop in ResultBanner.
 * Auto-dismisses so it never blocks the next card.
 */
export function MilestoneBanner() {
  const milestoneStreak = useGameStore((s) => s.milestoneStreak);
  const dismissMilestone = useGameStore((s) => s.dismissMilestone);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (milestoneStreak === null) return;
    const timer = setTimeout(() => dismissMilestone(), 2600);
    return () => clearTimeout(timer);
  }, [milestoneStreak, dismissMilestone]);

  return (
    <AnimatePresence>
      {milestoneStreak !== null && (
        <motion.div
          className="pointer-events-none fixed inset-x-4 top-24 z-50 flex justify-center"
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
        >
          <div className="glass-panel relative flex w-full max-w-sm flex-col items-center overflow-hidden rounded-[var(--r-xl)] px-6 py-5">
            {!reduceMotion &&
              Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
                const { x, y } = particleOffset(i);
                return (
                  <motion.span
                    key={i}
                    className="absolute h-1.5 w-1.5 rounded-full"
                    style={{ background: i % 2 === 0 ? "var(--gold-500)" : "var(--volt-500)" }}
                    initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
                    animate={{ opacity: 0, x, y, scale: 0.4 }}
                    transition={{ duration: 1.1, ease: "easeOut" }}
                  />
                );
              })}
            <p className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-[var(--gold-600)]">
              {milestoneStreak} in a row!
            </p>
            <p className="mt-1 text-sm text-[var(--ink-700)]">You&apos;re reading this game perfectly.</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
