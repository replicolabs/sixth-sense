"use client";

import type { PredictionCard } from "@sixth-sense/shared";
import { motion, useReducedMotion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";
import { CountdownRing } from "./CountdownRing";
import { GlassPanel } from "./ui/GlassPanel";

/**
 * The star component (Section 11.3) — the visual and emotional center of
 * the live match screen, so it gets the boldest glass treatment and the
 * most motion. Spring entry from the bottom on every new card; once
 * locked, the chosen option fills and lifts while the other dims and
 * recedes (Section 10.5).
 */
export function PredictionCardPanel({ card }: { card: PredictionCard }) {
  const cardChoice = useGameStore((s) => s.cardChoice);
  const chooseCard = useGameStore((s) => s.chooseCard);
  const locked = cardChoice !== null;
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { y: 48, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={
        reduceMotion ? { duration: 0.2 } : { type: "spring", stiffness: 260, damping: 24 }
      }
    >
      <GlassPanel radius="xl" className="p-6">
        <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)]">
          {card.question}
        </p>

        <div className="mt-5 flex items-center gap-3">
          <motion.button
            className="flex-1 rounded-[var(--r-pill)] py-3 font-semibold"
            style={{
              backgroundColor: cardChoice === "yes" ? "var(--volt-500)" : "var(--cream-sunken)",
              color: cardChoice === "yes" ? "var(--ink-900)" : locked ? "var(--ink-400)" : "var(--ink-900)",
            }}
            animate={{
              scale: cardChoice === "yes" ? 1.04 : locked ? 0.96 : 1,
              y: cardChoice === "yes" ? -2 : 0,
              opacity: locked && cardChoice !== "yes" ? 0.5 : 1,
            }}
            whileTap={locked ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => chooseCard("yes")}
            disabled={locked}
          >
            YES
          </motion.button>
          <motion.button
            className="flex-1 rounded-[var(--r-pill)] py-3 font-semibold"
            style={{
              backgroundColor: cardChoice === "no" ? "var(--pine-700)" : "var(--cream-sunken)",
              color: cardChoice === "no" ? "white" : locked ? "var(--ink-400)" : "var(--ink-900)",
            }}
            animate={{
              scale: cardChoice === "no" ? 1.04 : locked ? 0.96 : 1,
              y: cardChoice === "no" ? -2 : 0,
              opacity: locked && cardChoice !== "no" ? 0.5 : 1,
            }}
            whileTap={locked ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            onClick={() => chooseCard("no")}
            disabled={locked}
          >
            NO
          </motion.button>
          {locked && (
            <div className="shrink-0">
              <CountdownRing card={card} />
            </div>
          )}
        </div>

        <p className="mt-3 font-[family-name:var(--font-mono)] text-xs text-[var(--ink-500)]">
          {card.basePoints} base points · tier {card.difficultyTier}
        </p>
      </GlassPanel>
    </motion.div>
  );
}
