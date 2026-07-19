"use client";

import { Flame } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

interface FlameTier {
  size: number;
  color: string;
  glow?: boolean;
}

function tierFor(streak: number): FlameTier {
  if (streak >= 10) return { size: 32, color: "var(--volt-500)", glow: true };
  if (streak >= 7) return { size: 28, color: "var(--gold-600)", glow: true };
  if (streak >= 5) return { size: 24, color: "var(--gold-600)" };
  if (streak >= 3) return { size: 20, color: "var(--gold-500)" };
  if (streak >= 1) return { size: 17, color: "var(--gold-500)" };
  return { size: 15, color: "var(--ink-400)" };
}

/**
 * Section 10.5: "the streak flame grows one notch" on a win, "snuffs out
 * with a small puff" on a loss. The AnimatePresence `key={streak}` swap
 * gives every streak change its own little scale-in beat, including the
 * drop back to the dim/unlit state at 0.
 */
export function StreakFlame({ streak }: { streak: number }) {
  const tier = tierFor(streak);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: 32, height: 32 }}>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={streak}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{
            scale: 1,
            opacity: 1,
            filter: tier.glow ? `drop-shadow(0 0 6px ${tier.color})` : "none",
          }}
          exit={{ scale: 0.6, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
        >
          <Flame size={tier.size} color={tier.color} fill={streak > 0 ? tier.color : "none"} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
