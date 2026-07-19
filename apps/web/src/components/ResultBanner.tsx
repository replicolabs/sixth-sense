"use client";

import { pickEncouragementLine } from "@sixth-sense/shared";
import { motion, useReducedMotion } from "framer-motion";
import type { ResolvedCardResult } from "@/store/gameStore";

/**
 * Section 10.5 win/loss reactions: a quick scale pop on a win, a gentle
 * horizontal shake on a loss — never a harsh failure state, just an
 * encouraging line (Section 2/17). Keyed by card id so a new result always
 * replays its animation from scratch.
 */
export function ResultBanner({ result }: { result: ResolvedCardResult }) {
  const reduceMotion = useReducedMotion();

  if (result.personalOutcome === "void") {
    return (
      <div className="rounded-[var(--r-lg)] bg-[var(--cream-sunken)] px-5 py-3 text-center text-sm text-[var(--ink-500)]">
        Card missed — you didn&apos;t call this one.
      </div>
    );
  }

  const isWin = result.personalOutcome === "win";
  const motionProps = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 } }
    : isWin
      ? { initial: { scale: 1, opacity: 0 }, animate: { scale: [1, 1.06, 1], opacity: 1 } }
      : { initial: { x: 0, opacity: 0 }, animate: { x: [0, -6, 6, -4, 4, 0], opacity: 1 } };

  return (
    <motion.div
      key={result.card.id}
      {...motionProps}
      transition={{ duration: 0.4 }}
      className={`rounded-[var(--r-lg)] px-5 py-4 text-center ${isWin ? "bg-[var(--win)]/10" : "bg-[var(--loss)]/10"}`}
    >
      {isWin ? (
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--win)]">
          +{result.awardedPoints} points!
        </p>
      ) : (
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--loss)]">
          {pickEncouragementLine(result.card.windowStartSeq)}
        </p>
      )}
    </motion.div>
  );
}
