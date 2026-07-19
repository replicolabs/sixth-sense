"use client";

import type { MatchUpdate } from "@sixth-sense/shared";
import { useState } from "react";
import { WalletDebugPanel } from "@/components/WalletDebugPanel";

interface DemoMatchResponse {
  fixtureInfo?: { participant1: string; participant2: string; competition: string };
  events?: MatchUpdate[];
  error?: string;
}

/**
 * Phase 1 ship criterion (CLAUDE.md Section 16): a page that shows real,
 * normalized match events for one real fixture, pulled from
 * /api/scores/historical via packages/txline. Not styled to the Section 10
 * design system yet — that's Phase 4.
 */
export default function DemoMatchPage() {
  const [fixtureId, setFixtureId] = useState("");
  const [startEpochDay, setStartEpochDay] = useState("");
  const [data, setData] = useState<DemoMatchResponse | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadMatch() {
    setLoading(true);
    setData(null);
    try {
      const params = new URLSearchParams({ fixtureId });
      if (startEpochDay) params.set("startEpochDay", startEpochDay);
      const res = await fetch(`/api/demo-match?${params.toString()}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--ink-900)]">
        Sixth Sense — Replay data check
      </h1>
      <p className="mt-2 text-[var(--ink-500)]">
        Pulls one real match from TxLINE&apos;s historical endpoint and prints the normalized
        events. This proves the data pipeline end to end.
      </p>

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-4 py-2"
          placeholder="Fixture ID"
          value={fixtureId}
          onChange={(e) => setFixtureId(e.target.value)}
        />
        <input
          className="w-36 rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-4 py-2"
          placeholder="startEpochDay"
          value={startEpochDay}
          onChange={(e) => setStartEpochDay(e.target.value)}
        />
        <button
          className="rounded-[var(--r-pill)] bg-[var(--volt-500)] px-5 py-2 font-medium text-[var(--ink-900)] disabled:opacity-50"
          onClick={loadMatch}
          disabled={loading || !fixtureId}
        >
          {loading ? "Loading…" : "Load match"}
        </button>
      </div>

      {data?.error && (
        <p className="mt-6 rounded-[var(--r-md)] bg-[var(--loss)]/10 p-4 text-[var(--loss)]">
          {data.error}
        </p>
      )}

      {data?.fixtureInfo && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold">
            {data.fixtureInfo.participant1} vs {data.fixtureInfo.participant2}
          </h2>
          <p className="text-[var(--ink-500)]">{data.fixtureInfo.competition}</p>
          <p className="mt-2 font-mono text-sm text-[var(--ink-500)]">
            {data.events?.length ?? 0} events
          </p>
          <ol className="mt-4 space-y-2 font-mono text-xs">
            {data.events?.map((event, i) => (
              <li key={i} className="rounded-[var(--r-sm)] bg-[var(--cream-sunken)] p-2">
                <span className="font-semibold">{event.action}</span> seq={event.seq} ts={event.ts}
                {event.confirmed ? "" : " (unconfirmed)"}
              </li>
            ))}
          </ol>
        </div>
      )}

      <WalletDebugPanel />
    </main>
  );
}
