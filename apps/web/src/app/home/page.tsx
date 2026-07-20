"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, History, Coins } from "lucide-react";
import type { FixtureInfo } from "@sixth-sense/shared";
import { AppNav } from "@/components/AppNav";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { StreakFlame } from "@/components/ui/StreakFlame";
import { LiveTag } from "@/components/ui/LiveTag";

interface ProfileSummary {
  nickname: string;
  bestStreak: number;
  lifetimeWins: number;
}

interface LiveFixturesResponse {
  configured: boolean;
  live: FixtureInfo[];
  upcoming: FixtureInfo[];
}

function MatchRow({ fixture, kickoffLabel }: { fixture: FixtureInfo; kickoffLabel?: string }) {
  return (
    <Link href={`/play?live=${fixture.fixtureId}`}>
      <GlassPanel
        radius="lg"
        className="flex items-center justify-between px-4 py-3 transition-transform hover:-translate-y-0.5"
      >
        <div>
          <p className="text-sm font-semibold text-[var(--ink-900)]">
            {fixture.participant1} vs {fixture.participant2}
          </p>
          <p className="text-xs text-[var(--ink-500)]">{fixture.competition}</p>
        </div>
        {kickoffLabel ? (
          <p className="text-xs font-medium text-[var(--ink-500)]">{kickoffLabel}</p>
        ) : (
          <LiveTag />
        )}
      </GlassPanel>
    </Link>
  );
}

/**
 * The signed-in app home: real live and upcoming matches (CLAUDE.md
 * Section 11.2), plus a way into the demo match, the leaderboard, and the
 * Classics shelf. Full-width stacked sections rather than a fixed narrow
 * sidebar, a real desktop layout audit found the earlier two-column
 * split (a flexible main column next to a fixed 360px sidebar) both
 * squeezed the sign-in button into a broken shape and left most of a
 * wide viewport empty, since neither column had enough content to fill
 * real estate on its own. Every section here spans the full content
 * width and uses its own internal grid instead.
 */
export default function AppHomePage() {
  const { authenticated, login, user } = usePrivy();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [fixtures, setFixtures] = useState<LiveFixturesResponse | null>(null);

  useEffect(() => {
    if (!authenticated || !user) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/users/me?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setProfile(body);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authenticated, user]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fixtures/live")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled) setFixtures(body);
      })
      .catch(() => {
        if (!cancelled) setFixtures(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const hasLive = !!fixtures?.live.length;
  const hasUpcoming = !!fixtures?.upcoming.length;

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 pb-20 pt-6 sm:px-6 lg:px-10">
      <AppNav />

      {/* Status row: greeting/streak on the left, provably-fair note on the right. Full width, never a squeezed side panel. */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr]"
      >
        {authenticated ? (
          <GlassPanel radius="lg" className="flex items-center justify-between gap-4 px-6 py-5">
            <div>
              <p className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
                Welcome back{profile ? `, ${profile.nickname}` : ""}
              </p>
              {profile && (
                <p className="mt-1 text-sm text-[var(--ink-500)]">
                  Best streak {profile.bestStreak}, {profile.lifetimeWins} calls won
                </p>
              )}
            </div>
            <StreakFlame streak={profile?.bestStreak ?? 0} />
          </GlassPanel>
        ) : (
          <GlassPanel radius="lg" className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
            <span className="text-sm text-[var(--ink-700)]">Save your progress</span>
            <PrimaryButton onClick={login} className="px-5 py-2 text-sm">
              Sign in
            </PrimaryButton>
          </GlassPanel>
        )}

        <GlassPanel radius="lg" className="flex flex-col justify-center px-6 py-5">
          <p className="text-sm font-semibold text-[var(--ink-900)]">Provably fair</p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">
            Every call settles against real match data on chain. Always.
          </p>
        </GlassPanel>
      </motion.section>

      {/* Play now: the single biggest, boldest card on the page. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)]">
          Play now
        </h2>
        <Link href="/play">
          <GlassPanel
            variant="thick"
            radius="xl"
            className="flex flex-col items-start justify-between gap-4 p-6 transition-transform hover:-translate-y-0.5 sm:flex-row sm:items-center sm:p-8"
          >
            <div>
              <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)] sm:text-3xl">
                England vs Argentina
              </p>
              <p className="mt-1 text-sm text-[var(--ink-500)]">A real World Cup match, ready right now.</p>
            </div>
            <PrimaryButton className="px-6 py-3">Play</PrimaryButton>
          </GlassPanel>
        </Link>
      </section>

      {/* Live and upcoming matches: a real grid that scales with viewport width, and a composed state when there's nothing on right now. */}
      <section className="flex flex-col gap-4">
        {hasLive && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">Live now</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fixtures!.live.map((f) => (
                <MatchRow key={f.fixtureId} fixture={f} />
              ))}
            </div>
          </div>
        )}

        {hasUpcoming && (
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">Starting soon</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {fixtures!.upcoming.map((f) => (
                <MatchRow
                  key={f.fixtureId}
                  fixture={f}
                  kickoffLabel={new Date(f.startTime).toLocaleTimeString([], {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                />
              ))}
            </div>
          </div>
        )}

        {!hasLive && !hasUpcoming && (
          <GlassPanel radius="lg" className="flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
              No live matches right now
            </p>
            <p className="max-w-sm text-sm text-[var(--ink-500)]">
              Play the demo match above, or pick a real finished match from Classics.
            </p>
            <Link href="/classics" className="mt-2">
              <SecondaryButton>Browse Classics</SecondaryButton>
            </Link>
          </GlassPanel>
        )}
      </section>

      {/* Closing row: quick links out to the rest of the product, giving the page a real bottom instead of trailing off. */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Link href="/classics">
          <GlassPanel radius="lg" className="flex items-center gap-3 px-5 py-4 transition-transform hover:-translate-y-0.5">
            <History className="h-5 w-5 shrink-0 text-[var(--volt-600)]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold text-[var(--ink-900)]">Classics</p>
              <p className="text-xs text-[var(--ink-500)]">Real matches, ready any time</p>
            </div>
          </GlassPanel>
        </Link>
        <Link href="/leaderboard">
          <GlassPanel radius="lg" className="flex items-center gap-3 px-5 py-4 transition-transform hover:-translate-y-0.5">
            <Trophy className="h-5 w-5 shrink-0 text-[var(--gold-500)]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold text-[var(--ink-900)]">Leaderboard</p>
              <p className="text-xs text-[var(--ink-500)]">See where you stand</p>
            </div>
          </GlassPanel>
        </Link>
        <Link href="/pools">
          <GlassPanel radius="lg" className="flex items-center gap-3 px-5 py-4 transition-transform hover:-translate-y-0.5">
            <Coins className="h-5 w-5 shrink-0 text-[var(--gold-500)]" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-semibold text-[var(--ink-900)]">Pools</p>
              <p className="text-xs text-[var(--ink-500)]">Stake on a week of matches</p>
            </div>
          </GlassPanel>
        </Link>
      </section>
    </main>
  );
}
