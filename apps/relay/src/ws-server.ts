import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  initCardEngineState,
  initMatchState,
  maybeGenerateCard,
  reduceMatchState,
  resolveCard,
  type MatchState,
  type NormalizedMatchEvent,
  type PredictionCard,
  type RelayMessage,
} from "@sixth-sense/shared";
import type { Keypair } from "@solana/web3.js";
import { WebSocketServer, type WebSocket } from "ws";
import { liveFixtureEvents } from "./live-engine";
import { replayFixture, type ReplayOptions } from "./replay-engine";

function send(socket: WebSocket, message: RelayMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

function broadcast(wss: WebSocketServer, message: RelayMessage) {
  const text = JSON.stringify(message);
  for (const client of wss.clients as Set<WebSocket>) {
    if (client.readyState === client.OPEN) client.send(text);
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function fixtureCachePath(fixtureId: string): string {
  return fileURLToPath(new URL(`../../../fixtures/${fixtureId}.json`, import.meta.url));
}

export function fixtureIsCached(fixtureId: string): boolean {
  return existsSync(fixtureCachePath(fixtureId));
}

/**
 * Runs the card engine over ANY event source (a cached replay or the real
 * live stream — CLAUDE.md Section 12: "the frontend cannot tell live from
 * replay... identical code path otherwise") and emits every message
 * through `emit` only — used by the shared default broadcast (emit =
 * broadcast to every client), a single Classics session (emit = send to
 * one client), and now the live broadcast too. Each call gets its own
 * matchState/card-engine state, so sessions never leak into each other
 * (EXPANSION.md Section 2).
 */
async function runEventStream(
  fixtureId: string,
  mode: "replay" | "live",
  events: AsyncGenerator<NormalizedMatchEvent>,
  emit: (message: RelayMessage) => void,
): Promise<void> {
  emit({ type: "replay_starting", fixtureId });

  let matchState: MatchState | null = null;
  let cardEngineState = initCardEngineState();
  let activeCard: PredictionCard | null = null;

  for await (const event of events) {
    matchState = matchState
      ? reduceMatchState(matchState, event)
      : reduceMatchState(initMatchState(event.fixtureInfo), event);

    emit({ type: "match_event", mode, payload: event });

    if (activeCard) {
      const outcome = resolveCard(activeCard, matchState, event);
      if (outcome) {
        emit({
          type: "card_resolved",
          payload: { cardId: activeCard.id, outcome, resolvedSeq: event.update.seq },
        });
        activeCard = null;
      }
    }

    if (!activeCard) {
      const generated = maybeGenerateCard(matchState, cardEngineState, event);
      if (generated) {
        activeCard = generated.card;
        cardEngineState = generated.engineState;
        emit({ type: "card_issued", payload: activeCard });
      }
    }

    if (event.update.action === "game_finalised" && mode === "live") break;
  }

  emit({ type: "replay_complete" });
}

async function runReplayOnce(
  fixtureId: string,
  options: ReplayOptions,
  emit: (message: RelayMessage) => void,
): Promise<void> {
  await runEventStream(fixtureId, "replay", replayFixture(fixtureId, options), emit);
}

/**
 * One shared replay loop broadcasting to every connected client — mirrors
 * the live-mode rule in CLAUDE.md Section 5 ("the relay owns one long-lived
 * subscription and fans one stream out to all clients. Do not open a
 * stream per user"). This is the always-on default/demo match everyone
 * lands on; per-connection Classics sessions (below) are a separate,
 * deliberately private path and don't touch this loop or its state.
 *
 * Loops forever — found by actually playing it: a one-shot replay left an
 * in-progress card stuck forever once the match ended (nothing left to
 * trigger its resolution), and any reload after that point got nothing at
 * all since the loop had already finished. CLAUDE.md Section 12 also wants
 * Replay Mode "bulletproof," which a dead-ending demo isn't.
 */
export function startReplayBroadcast(
  wss: WebSocketServer,
  fixtureId: string,
  options: ReplayOptions,
): void {
  (async () => {
    for (;;) {
      console.log(
        `Replay broadcast starting: fixture=${fixtureId} acceleration=${options.accelerationFactor ?? 40}x`,
      );
      await runReplayOnce(fixtureId, options, (message) => broadcast(wss, message));
      console.log("Replay broadcast complete — restarting shortly");
      await sleep(10_000);
    }
  })().catch((err) => {
    console.error("Replay broadcast failed:", err);
  });
}

/**
 * CLAUDE.md Phase 7: the real live path, broadcast to every connected
 * client exactly like the replay broadcast (same shared-fanout rule).
 * Runs once through the featured fixture's real match — once it ends
 * (game_finalised), the relay goes idle for this broadcast rather than
 * looping (unlike replay, there's no cached data to loop back over; a
 * new live fixture needs a fresh restart with a new LIVE_FIXTURE_ID,
 * since auto-discovering "whatever's live now" is a match-list feature
 * that doesn't exist yet — CLAUDE.md Section 11.2).
 */
export function startLiveBroadcast(
  wss: WebSocketServer,
  fixtureId: string,
  serviceWallet: Keypair,
  subscribeTxSig: string,
): void {
  (async () => {
    console.log(`Live broadcast starting: fixture=${fixtureId}`);
    await runEventStream(
      fixtureId,
      "live",
      liveFixtureEvents(fixtureId, serviceWallet, subscribeTxSig),
      (message) => broadcast(wss, message),
    );
    console.log(`Live broadcast for fixture ${fixtureId} ended (match finalised).`);
  })().catch((err) => {
    console.error("Live broadcast failed:", err);
  });
}

/**
 * EXPANSION.md Section 2 (Classics shelf): a client picks a specific
 * archived fixture from the shelf and connects with `?fixtureId=<id>`
 * instead of joining the shared default broadcast. Plays through once —
 * the shared broadcast loops forever because it's an always-on background
 * demo nobody explicitly started, but a Classics session is a deliberate
 * run the user chose from the shelf, so it ends when the match does. The
 * user reconnects (same fixtureId) to replay it, or picks another from the
 * shelf, exactly like reopening a video rather than it looping on its own.
 */
async function runClassicsSession(
  socket: WebSocket,
  fixtureId: string,
  options: ReplayOptions,
): Promise<void> {
  console.log(
    `Classics session starting: fixture=${fixtureId} acceleration=${options.accelerationFactor ?? 40}x`,
  );
  try {
    await runReplayOnce(fixtureId, options, (message) => send(socket, message));
    console.log(`Classics session complete: fixture=${fixtureId}`);
  } catch (err) {
    console.error(`Classics session failed: fixture=${fixtureId}`, err);
  }
}

export function createWsServer(port: number, defaultOptions: ReplayOptions): WebSocketServer {
  const wss = new WebSocketServer({ port });
  wss.on("connection", (socket, req) => {
    const fixtureId = new URL(req.url ?? "/", "http://relay").searchParams.get("fixtureId");

    if (!fixtureId) {
      console.log("Client connected (shared live/demo broadcast)");
      socket.on("close", () => console.log("Client disconnected"));
      return;
    }

    if (!fixtureIsCached(fixtureId)) {
      console.log(`Classics request for uncached fixture ${fixtureId} — closing`);
      socket.close(4004, "fixture not cached");
      return;
    }

    console.log(`Client connected (classics: ${fixtureId})`);
    socket.on("close", () => console.log(`Client disconnected (classics: ${fixtureId})`));
    runClassicsSession(socket, fixtureId, defaultOptions);
  });
  console.log(`Relay WebSocket server listening on ${port}`);
  return wss;
}
