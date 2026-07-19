"use client";

import { CLUB_KIT_CATALOG, type MatchState } from "@sixth-sense/shared";
import Link from "next/link";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ShareCardButton } from "@/components/ShareCard";

export interface SessionSummary {
  sessionId: string;
  pointsTotal: number;
  callsMade: number;
  callsWon: number;
  accuracy: number;
  bestStreak: number;
  lifetimePoints: number;
  newlyUnlockedKitIds: string[];
  settlement: { status: "proven" | "failed" | "skipped"; txSig?: string };
}

function kitName(kitId: string): string {
  return CLUB_KIT_CATALOG.find((k) => k.id === kitId)?.name ?? kitId;
}

/**
 * CLAUDE.md Section 11.6: "a beautiful summary: calls made, calls won,
 * best streak, points earned, accuracy, and a 'provably fair' note" plus
 * "a small, optional 'See the proof' link that opens the settlement
 * detail (Solana signature)." `summary` is null while POST
 * /api/sessions/complete is still in flight.
 */
export function SessionSummaryPanel({
  summary,
  classicsMode,
  matchState,
}: {
  summary: SessionSummary | null;
  classicsMode: boolean;
  matchState: MatchState | null;
}) {
  if (!summary) {
    return (
      <GlassPanel radius="lg" className="p-5 text-center">
        <p className="text-sm text-[var(--ink-500)]">Full time. Tallying your calls…</p>
      </GlassPanel>
    );
  }

  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "mainnet-beta" : "devnet";
  const explorerUrl = summary.settlement.txSig
    ? `https://explorer.solana.com/tx/${summary.settlement.txSig}?cluster=${cluster}`
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <GlassPanel radius="lg" className="p-5">
        <p className="text-center font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
          Full time
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 font-[family-name:var(--font-mono)]">
          <div className="text-center">
            <p className="text-2xl font-semibold text-[var(--ink-900)]">{summary.pointsTotal}</p>
            <p className="text-xs text-[var(--ink-500)]">Points earned</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[var(--ink-900)]">{summary.bestStreak}</p>
            <p className="text-xs text-[var(--ink-500)]">Best streak</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[var(--ink-900)]">
              {summary.callsWon}/{summary.callsMade}
            </p>
            <p className="text-xs text-[var(--ink-500)]">Calls won</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-semibold text-[var(--ink-900)]">
              {Math.round(summary.accuracy * 100)}%
            </p>
            <p className="text-xs text-[var(--ink-500)]">Accuracy</p>
          </div>
        </div>

        {summary.newlyUnlockedKitIds.length > 0 && (
          <div className="mt-4 rounded-[var(--r-md)] bg-[var(--gold-500)]/15 px-3 py-2 text-center text-sm text-[var(--ink-900)]">
            New kit unlocked: <span className="font-semibold">{summary.newlyUnlockedKitIds.map(kitName).join(", ")}</span>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-[var(--ink-500)]">
          {summary.settlement.status === "proven" && (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--win)]" />
              <span>Provably fair</span>
              {explorerUrl && (
                <a href={explorerUrl} target="_blank" rel="noreferrer" className="font-medium text-[var(--pine-700)]">
                  · See the proof
                </a>
              )}
            </>
          )}
          {summary.settlement.status === "failed" && <span>Settlement is still catching up — check back soon.</span>}
          {summary.settlement.status === "skipped" && <span>Provably fair (settlement pending)</span>}
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <ShareCardButton summary={summary} matchState={matchState} />
          {classicsMode ? (
            <Link href="/classics">
              <span className="block rounded-[var(--r-pill)] bg-[var(--volt-500)] px-6 py-3 text-center font-semibold text-[var(--ink-900)]">
                Pick another classic
              </span>
            </Link>
          ) : (
            <p className="text-center text-xs text-[var(--ink-400)]">The next match starts in a few seconds…</p>
          )}
          <Link href="/leaderboard" className="text-center text-sm font-medium text-[var(--pine-700)]">
            View leaderboard
          </Link>
        </div>
      </GlassPanel>
    </motion.div>
  );
}
