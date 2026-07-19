"use client";

import { useRelaySocket } from "@/hooks/useRelaySocket";

/**
 * Phase 2 ship criterion (CLAUDE.md Section 16): "the client receives a
 * real match replaying at speed." Raw event log, not styled to the design
 * system yet — that's Phase 4. The live match screen (Section 11.3) is
 * where this data actually becomes the game.
 */
export default function ReplayTestPage() {
  const wsUrl = process.env.NEXT_PUBLIC_RELAY_WS_URL ?? "ws://localhost:8080";
  const { connected, events, replayComplete } = useRelaySocket(wsUrl);

  return (
    <main className="mx-auto max-w-2xl p-6 font-sans">
      <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--ink-900)]">
        Replay stream check
      </h1>
      <p className="mt-2 text-[var(--ink-500)]">
        Connects to the relay&apos;s WebSocket and shows real match events arriving live, on the
        accelerated replay clock.
      </p>

      <p className="mt-4 font-mono text-sm">
        {connected ? "connected" : "connecting…"} — {events.length} events
        {replayComplete ? " — replay complete" : ""}
      </p>

      <ol className="mt-4 space-y-2 font-mono text-xs">
        {events
          .slice(-40)
          .reverse()
          .map((event, i) => (
            <li key={i} className="rounded-[var(--r-sm)] bg-[var(--cream-sunken)] p-2">
              <span className="font-semibold">{event.update.action}</span> seq={event.update.seq}{" "}
              clock={event.update.clock.seconds}s
              {event.update.confirmed ? "" : " (unconfirmed)"}
            </li>
          ))}
      </ol>
    </main>
  );
}
