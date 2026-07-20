"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton } from "@/components/ui/Buttons";
import { TeamFlag } from "@/components/TeamFlag";

interface ClassicRow {
  id: string;
  fixtureId: string;
  competition: string;
  season: string;
  participant1: string;
  participant2: string;
  participant1Score: number;
  participant2Score: number;
  kickoffDate: string;
  tags: string[];
}

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * EXPANSION.md Section 2: the Classics shelf. A searchable library of real,
 * TxLINE-verified matches we captured ourselves before their historical
 * window closed (see packages/txline/src/archive-fixture.ts), every one
 * keeps its full Provably Fair capability, same as a live match. Picking a
 * card starts a private replay session on /play (?fixtureId=...), isolated
 * from the shared live/demo broadcast (apps/relay/src/ws-server.ts).
 */
export default function ClassicsPage() {
  const [query, setQuery] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const debouncedQuery = useDebounced(query, 300);
  const [matches, setMatches] = useState<ClassicRow[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (activeTag) params.set("tag", activeTag);
    fetch(`/api/classics?${params.toString()}`)
      .then((res) => res.json())
      .then((body: { matches: ClassicRow[] }) => {
        if (!cancelled) setMatches(body.matches);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, activeTag]);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    for (const match of matches ?? []) {
      for (const tag of match.tags) tags.add(tag);
    }
    return [...tags].sort();
  }, [matches]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <AppNav />

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--r-lg)] bg-[var(--pine-800)]">
          <History className="h-7 w-7 text-[var(--volt-500)]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--ink-900)]">
            Classics
          </h1>
          <p className="text-sm text-[var(--ink-500)]">
            Real matches, ready any time. Every one settles the same way a live call does.
          </p>
        </div>
      </div>

      <input
        type="text"
        inputMode="search"
        placeholder="Search a team, competition, or moment"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-xl rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-4 py-3 text-[var(--ink-900)] placeholder:text-[var(--ink-400)] focus:outline-none focus:ring-2 focus:ring-[var(--volt-500)]"
      />

      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {availableTags.map((tag) => {
            const isActive = activeTag === tag;
            return (
              <button
                key={tag}
                onClick={() => setActiveTag(isActive ? null : tag)}
                className={`rounded-[var(--r-pill)] px-3 py-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  isActive
                    ? "bg-[var(--volt-500)] text-[var(--ink-900)]"
                    : "bg-[var(--cream-sunken)] text-[var(--ink-500)]"
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      )}

      {loading && matches === null && (
        <p className="text-center text-sm text-[var(--ink-500)]">Loading classics…</p>
      )}

      {matches !== null && matches.length === 0 && (
        <GlassPanel radius="lg" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <History className="h-8 w-8 text-[var(--ink-400)]" strokeWidth={1.5} />
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
            No matches found
          </p>
          <p className="max-w-sm text-sm text-[var(--ink-500)]">Try a different search or clear the filter.</p>
        </GlassPanel>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {matches?.map((match) => (
          <GlassPanel key={match.id} radius="lg" className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                {match.competition} · {match.season}
              </span>
              <span className="text-xs text-[var(--ink-400)]">
                {new Date(match.kickoffDate).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>

            <div className="mt-2 flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink-900)]">
                  <TeamFlag teamId={match.participant1} teamName={match.participant1} />
                  <span className="truncate">{match.participant1}</span>
                </p>
                <p className="flex items-center gap-1.5 truncate font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink-900)]">
                  <TeamFlag teamId={match.participant2} teamName={match.participant2} />
                  <span className="truncate">{match.participant2}</span>
                </p>
              </div>
              <div className="flex flex-col items-end font-[family-name:var(--font-mono)] text-lg font-semibold text-[var(--ink-900)]">
                <span>{match.participant1Score}</span>
                <span>{match.participant2Score}</span>
              </div>
            </div>

            {match.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {match.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-[var(--r-pill)] bg-[var(--cream-sunken)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-500)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <Link href={`/play?fixtureId=${match.fixtureId}`} className="mt-3 block">
              <PrimaryButton className="w-full">Play this classic</PrimaryButton>
            </Link>
          </GlassPanel>
        ))}
      </div>
    </main>
  );
}
