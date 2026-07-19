"use client";

import type { NormalizedMatchEvent } from "@sixth-sense/shared";
import { AnimatePresence, motion } from "framer-motion";

const NOTABLE_ACTIONS = new Set([
  "goal",
  "shot",
  "corner",
  "yellow_card",
  "red_card",
  "var",
  "substitution",
  "penalty",
  "game_finalised",
]);

/** Section 11.3 event ticker — compact feed of confirmed, notable events, sliding in as they arrive. */
export function EventTicker({ events }: { events: NormalizedMatchEvent[] }) {
  const notable = events
    .filter((e) => e.update.confirmed && NOTABLE_ACTIONS.has(e.update.action))
    .slice(-8)
    .reverse();

  if (notable.length === 0) {
    return <p className="text-sm text-[var(--ink-400)]">Waiting for the first notable moment…</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      <AnimatePresence initial={false}>
        {notable.map((event) => (
          <motion.li
            key={event.update.seq}
            layout
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="rounded-[var(--r-sm)] bg-[var(--cream-sunken)] px-3 py-1.5 text-sm text-[var(--ink-700)]"
          >
            <span className="font-semibold capitalize">{event.update.action.replace(/_/g, " ")}</span>
            <span className="ml-2 font-[family-name:var(--font-mono)] text-xs text-[var(--ink-500)]">
              {Math.floor(event.update.clock.seconds / 60)}&apos;
            </span>
          </motion.li>
        ))}
      </AnimatePresence>
    </ol>
  );
}
