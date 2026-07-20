"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
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
      <GlassPanel radius="lg" className="flex items-center justify-between px-4 py-3 transition-transform hover:-translate-y-0.5">
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
 * Section 11.2), pulled from /api/fixtures/live, plus a way into the demo
 * match and the Classics shelf. The landing page (/) is a separate,
 * image-led marketing surface, this is where people actually land once
 * they are in the product. Full desktop layout: a two-column grid above
 * the md breakpoint instead of a stretched single mobile column.
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

  const hasFixtures = fixtures && (fixtures.live.length > 0 || fixtures.upcoming.length > 0);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <AppNav />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <div className="flex flex-col gap-6 lg:order-1">
          <section className="flex flex-col gap-3">
            <h2 className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--ink-900)]">
              Play now
            </h2>
            <div className="flex flex-col gap-2">
              <Link href="/play">
                <GlassPanel variant="thick" radius="lg" className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--ink-900)]">
                      England vs Argentina
                    </p>
                    <p className="text-xs text-[var(--ink-500)]">Demo match, ready right now</p>
                  </div>
                  <PrimaryButton className="px-4 py-2 text-sm">Play</PrimaryButton>
                </GlassPanel>
              </Link>
            </div>
          </section>

          {hasFixtures && (
            <section className="flex flex-col gap-4">
              {fixtures!.live.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">Live now</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {fixtures!.live.map((f) => (
                      <MatchRow key={f.fixtureId} fixture={f} />
                    ))}
                  </div>
                </div>
              )}

              {fixtures!.upcoming.length > 0 && (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">Starting soon</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
            </section>
          )}

          <section>
            <Link href="/classics">
              <SecondaryButton className="w-full sm:w-auto">Browse real matches</SecondaryButton>
            </Link>
          </section>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="flex flex-col gap-4 lg:order-2"
        >
          {authenticated ? (
            <GlassPanel radius="lg" className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ink-900)]">
                  Welcome back{profile ? `, ${profile.nickname}` : ""}
                </p>
                {profile && (
                  <p className="text-xs text-[var(--ink-500)]">
                    Best streak {profile.bestStreak}, {profile.lifetimeWins} calls won
                  </p>
                )}
              </div>
              <StreakFlame streak={profile?.bestStreak ?? 0} />
            </GlassPanel>
          ) : (
            <GlassPanel radius="lg" className="flex items-center justify-between gap-3 px-5 py-4">
              <span className="text-sm text-[var(--ink-700)]">Sign in to save your streaks and unlocks.</span>
              <PrimaryButton onClick={login} className="px-4 py-1.5 text-sm">
                Sign in
              </PrimaryButton>
            </GlassPanel>
          )}

          <GlassPanel radius="lg" className="p-4">
            <p className="text-sm font-semibold text-[var(--ink-900)]">Provably fair</p>
            <p className="mt-1 text-xs text-[var(--ink-500)]">
              Every call settles against real match data on chain. Always.
            </p>
          </GlassPanel>
        </motion.div>
      </div>
    </main>
  );
}
