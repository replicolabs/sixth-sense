"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";
import { StreakFlame } from "@/components/ui/StreakFlame";

interface ProfileSummary {
  nickname: string;
  bestStreak: number;
  lifetimeWins: number;
}

const WHY_POINTS = [
  {
    title: "Call the moment, not the market",
    body: "No odds to read. You call what happens next, a goal, a card, a corner, right as it's about to happen.",
  },
  {
    title: "Know in seconds",
    body: "No waiting on a market to settle. The moment resolves live, and so does your result.",
  },
  {
    title: "Free to play. Real stakes if you want them",
    body: "Build your streak for free, every match. When you're ready, back your reads with a real stake.",
  },
];

/**
 * EXPANSION.md Section 3.2: positioning content aimed at people who already
 * like fast, live, outcome-based action, speaking to the itch (instant
 * action, live resolution, calling the next moment yourself) without
 * naming or disparaging any named competitor product, per 3.2's explicit
 * rule. Also fills the CLAUDE.md Section 11.2 home screen gap this
 * project has had since Phase 1 (this file was still the Next.js starter
 * template until now).
 */
export default function HomePage() {
  const { authenticated, login, user } = usePrivy();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);

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

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-4 pb-12 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
            Sixth Sense
          </span>
          <span className="breathing h-1.5 w-1.5 rounded-full bg-[var(--volt-500)]" />
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

      {authenticated ? (
        <GlassPanel radius="lg" className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              Welcome back{profile ? `, ${profile.nickname}` : ""}
            </p>
            {profile && (
              <p className="text-xs text-[var(--ink-500)]">
                Best streak {profile.bestStreak} · {profile.lifetimeWins} calls won
              </p>
            )}
          </div>
          <StreakFlame streak={profile?.bestStreak ?? 0} />
        </GlassPanel>
      ) : (
        <div className="glass-panel flex items-center justify-between rounded-[var(--r-md)] px-4 py-2.5">
          <span className="text-sm text-[var(--ink-700)]">Sign in to save your streaks and unlocks.</span>
          <PrimaryButton onClick={login} className="px-4 py-1.5 text-sm">
            Sign in
          </PrimaryButton>
        </div>
      )}

      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="flex flex-col gap-3 text-center"
      >
        <h1 className="font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.1] text-[var(--ink-900)]">
          Call it before it happens.
        </h1>
        <p className="text-[var(--ink-700)]">
          You know the itch: the game is live, something is about to happen, and you just know it. Sixth
          Sense is where you act on that feeling instead of just watching it play out.
        </p>
        <p className="text-sm text-[var(--ink-500)]">Same rush. Free to try. Real stakes only if you want them.</p>

        <div className="mt-2 flex flex-col gap-2">
          <Link href="/play">
            <PrimaryButton className="w-full">Play the demo match</PrimaryButton>
          </Link>
          <p className="text-xs text-[var(--ink-400)]">
            A real World Cup match, England vs Argentina, ready to play right now.
          </p>
          <Link href="/classics">
            <SecondaryButton className="w-full">Browse real matches</SecondaryButton>
          </Link>
        </div>
      </motion.section>

      <section className="flex flex-col gap-3">
        {WHY_POINTS.map((point) => (
          <GlassPanel key={point.title} radius="lg" className="p-4">
            <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink-900)]">
              {point.title}
            </p>
            <p className="mt-1 text-sm text-[var(--ink-500)]">{point.body}</p>
          </GlassPanel>
        ))}
      </section>

      <p className="text-center text-xs text-[var(--ink-400)]">
        Every call settles against real match data. Provably fair, always.
      </p>
    </main>
  );
}
