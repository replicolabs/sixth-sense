"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { EventTicker } from "@/components/EventTicker";
import { GameHud } from "@/components/GameHud";
import { MatchHero } from "@/components/MatchHero";
import { MilestoneBanner } from "@/components/MilestoneBanner";
import { PredictionCardPanel } from "@/components/PredictionCardPanel";
import { PrimaryButton } from "@/components/ui/Buttons";
import { ResultBanner } from "@/components/ResultBanner";
import { SessionSummaryPanel, type SessionSummary } from "@/components/SessionSummaryPanel";
import { useGameStore } from "@/store/gameStore";

/**
 * Phase 3 ship criterion (CLAUDE.md Section 16): "the game is fun to play
 * against replayed data." Phase 4: full Section 10 design system applied —
 * liquid glass, Bricolage/Geist type scale, spring motion throughout.
 */
function PlayPageInner() {
  const { authenticated, login, user } = usePrivy();
  const connect = useGameStore((s) => s.connect);
  const disconnect = useGameStore((s) => s.disconnect);
  const connected = useGameStore((s) => s.connected);
  const matchState = useGameStore((s) => s.matchState);
  const matchComplete = useGameStore((s) => s.matchComplete);
  const activeCard = useGameStore((s) => s.activeCard);
  const lastResult = useGameStore((s) => s.lastResult);
  const streak = useGameStore((s) => s.streak);
  const bestStreak = useGameStore((s) => s.bestStreak);
  const points = useGameStore((s) => s.points);
  const sessionPredictions = useGameStore((s) => s.sessionPredictions);
  const reconnectAttempts = useGameStore((s) => s.reconnectAttempts);
  const completedSessionRef = useRef(false);
  const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);

  // EXPANSION.md Section 2 (Classics shelf): ?fixtureId=<id> requests a
  // private, single-match replay session instead of the shared live/demo
  // broadcast — see apps/relay/src/ws-server.ts's per-connection handling.
  // Uses useSearchParams (not a mount-once read of window.location) because
  // the App Router can reuse this same route's component instance across a
  // Link-driven navigation that only changes the query string — a
  // mount-once value would keep pointing at whichever classic was current
  // when the component first mounted (a real bug caught by testing the
  // shelf -> play flow end to end: clicking a second classic kept playing
  // the first one).
  const classicsFixtureId = useSearchParams().get("fixtureId");

  useEffect(() => {
    const baseWsUrl = process.env.NEXT_PUBLIC_RELAY_WS_URL ?? "ws://localhost:8080";
    const wsUrl = classicsFixtureId ? `${baseWsUrl}?fixtureId=${classicsFixtureId}` : baseWsUrl;
    const accelerationFactor = Number(process.env.NEXT_PUBLIC_REPLAY_ACCELERATION ?? 1);
    connect(wsUrl, accelerationFactor);
    return () => disconnect();
  }, [connect, disconnect, classicsFixtureId]);

  // Phase 6: fold this session's real prediction history into Postgres,
  // trigger the on-chain settlement floor, and check for kit unlocks —
  // all in one call, once, when the match wraps up.
  useEffect(() => {
    if (!matchComplete || !user || completedSessionRef.current) return;
    if (sessionPredictions.length === 0) return; // nothing to submit
    completedSessionRef.current = true;
    const fixtureId = matchState?.fixtureInfo.fixtureId;
    if (!fixtureId) return;

    fetch("/api/sessions/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        privyId: user.id,
        fixtureId,
        mode: classicsFixtureId ? "replay" : "replay",
        predictions: sessionPredictions.map((p) => ({
          cardType: p.card.cardType,
          question: p.card.question,
          choice: p.choice,
          windowStartSeq: p.card.windowStartSeq,
          windowEndTs: p.card.windowEndTs,
          resolvedSeq: p.resolvedSeq,
          basePoints: p.card.basePoints,
          multiplier: p.multiplier,
          awardedPoints: p.awardedPoints,
          outcome: p.personalOutcome === "void" ? "void" : p.personalOutcome,
        })),
      }),
    })
      .then((res) => res.json())
      .then((body) => setSessionSummary(body))
      .catch((err) => console.error("session complete failed:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchComplete, user]);

  useEffect(() => {
    if (!matchComplete) {
      completedSessionRef.current = false;
      setSessionSummary(null);
    }
  }, [matchComplete]);

  // One key per visible state so AnimatePresence can crossfade between
  // the card, its result, and the idle "next call coming up" beat instead
  // of them just popping in and out.
  const slotKey = matchComplete
    ? "complete"
    : activeCard
      ? `card-${activeCard.id}`
      : lastResult
        ? `result-${lastResult.card.id}`
        : "idle";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <MilestoneBanner />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
            Sixth Sense
          </span>
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--volt-500)]" />
          {classicsFixtureId && (
            <span className="ml-1 rounded-[var(--r-pill)] bg-[var(--cream-sunken)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]">
              Classic
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Link href="/leaderboard" className="text-sm font-medium text-[var(--pine-700)]">
            Leaderboard
          </Link>
          <Link href="/pools" className="text-sm font-medium text-[var(--pine-700)]">
            Pools
          </Link>
          <Link href="/classics" className="text-sm font-medium text-[var(--pine-700)]">
            Classics
          </Link>
        </div>
      </header>

      {!authenticated && (
        <div className="glass-panel flex items-center justify-between rounded-[var(--r-md)] px-4 py-2.5">
          <span className="text-sm text-[var(--ink-700)]">Sign in to save your streaks and unlocks.</span>
          <PrimaryButton onClick={login} className="px-4 py-1.5 text-sm">
            Sign in
          </PrimaryButton>
        </div>
      )}

      {!matchState && (
        <p className="text-center text-sm text-[var(--ink-500)]">
          {connected
            ? "Waiting for match data…"
            : reconnectAttempts > 2
              ? "Having trouble connecting. Still trying…"
              : "Connecting…"}
        </p>
      )}

      {matchState && !connected && (
        <p className="text-center text-xs font-medium text-[var(--loss)]">
          Connection dropped — reconnecting…
        </p>
      )}

      {matchState && <MatchHero matchState={matchState} />}

      <GameHud streak={streak} bestStreak={bestStreak} points={points} />

      <AnimatePresence mode="wait">
        <motion.div
          key={slotKey}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {matchComplete && (
            <SessionSummaryPanel
              summary={sessionSummary}
              classicsMode={Boolean(classicsFixtureId)}
              matchState={matchState}
            />
          )}
          {!matchComplete && activeCard && <PredictionCardPanel card={activeCard} />}
          {!matchComplete && !activeCard && lastResult && <ResultBanner result={lastResult} />}
          {!matchComplete && !activeCard && !lastResult && matchState && (
            <p className="text-center text-sm text-[var(--ink-400)]">Next call coming up…</p>
          )}
        </motion.div>
      </AnimatePresence>

      {matchState && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
            Recent moments
          </p>
          <EventTicker events={matchState.recentEvents} />
        </div>
      )}
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={null}>
      <PlayPageInner />
    </Suspense>
  );
}
