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
import { checkLiveFixture, liveFixtureEvents } from "./live-engine";
import { replayFixture, type ReplayOptions } from "./replay-engine";

function send(socket: WebSocket, message: RelayMessage) {
  if (socket.readyState === socket.OPEN) socket.send(JSON.stringify(message));
}

/**
 * Sockets on the shared default broadcast (no `?fixtureId=` / `?live=`
 * param) — NOT `wss.clients`, which is every socket connected to this
 * process regardless of which path routed them. Found by actually
 * testing two live channels at once: both were also receiving the
 * shared replay broadcast's messages, because `wss.clients` doesn't
 * distinguish Classics/live sockets from default ones — a real,
 * pre-existing bug (every Classics session has been leaking the shared
 * broadcast's messages into itself this whole time), just never caught
 * until on-demand live channels made it obvious.
 */
const defaultBroadcastSockets = new Set<WebSocket>();

function broadcast(message: RelayMessage) {
  const text = JSON.stringify(message);
  for (const client of defaultBroadcastSockets) {
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
export function startReplayBroadcast(fixtureId: string, options: ReplayOptions): void {
  (async () => {
    for (;;) {
      console.log(
        `Replay broadcast starting: fixture=${fixtureId} acceleration=${options.accelerationFactor ?? 40}x`,
      );
      await runReplayOnce(fixtureId, options, (message) => broadcast(message));
      console.log("Replay broadcast complete — restarting shortly");
      await sleep(10_000);
    }
  })().catch((err) => {
    console.error("Replay broadcast failed:", err);
  });
}

export interface LiveDeps {
  serviceWallet: Keypair;
  subscribeTxSig: string;
}

interface LiveChannel {
  sockets: Set<WebSocket>;
}

/**
 * On-demand live channels, keyed by fixtureId — replaces the old
 * boot-time LIVE_FIXTURE_ID model (one hardcoded fixture, needed a
 * process restart to change). A user picks any real, currently-listed
 * fixture from the home screen (GET /api/fixtures/live in apps/web) and
 * connects with `?live=<fixtureId>`; the first request for a given
 * fixture starts its demux off the shared global TxLINE live stream
 * (still only one long-lived TxLINE session per fixture actually being
 * watched, not per user — CLAUDE.md Section 5), and every later request
 * for the SAME fixture just joins the existing channel's broadcast set.
 * The channel tears itself down when the match ends or the stream
 * errors out, so a later request for the same (or a re-started) fixture
 * starts clean.
 */
const liveChannels = new Map<string, LiveChannel>();

function broadcastToChannel(channel: LiveChannel, message: RelayMessage) {
  const text = JSON.stringify(message);
  for (const socket of channel.sockets) {
    if (socket.readyState === socket.OPEN) socket.send(text);
  }
}

function joinLiveChannel(fixtureId: string, deps: LiveDeps, socket: WebSocket): void {
  let channel = liveChannels.get(fixtureId);
  if (channel) {
    channel.sockets.add(socket);
    socket.on("close", () => channel!.sockets.delete(socket));
    return;
  }

  channel = { sockets: new Set([socket]) };
  liveChannels.set(fixtureId, channel);
  socket.on("close", () => channel!.sockets.delete(socket));

  (async () => {
    console.log(`Live channel starting: fixture=${fixtureId}`);
    const fixtureInfo = await checkLiveFixture(fixtureId, deps.serviceWallet, deps.subscribeTxSig);

    if (new Date(fixtureInfo.startTime).getTime() > Date.now()) {
      broadcastToChannel(channel!, { type: "live_pending", fixtureId, startTime: fixtureInfo.startTime });
    }

    await runEventStream(
      fixtureId,
      "live",
      liveFixtureEvents(fixtureId, deps.serviceWallet, deps.subscribeTxSig),
      (message) => broadcastToChannel(channel!, message),
    );
    console.log(`Live channel for fixture ${fixtureId} ended (match finalised).`);
  })()
    .catch((err) => {
      console.error(`Live channel for fixture ${fixtureId} failed:`, err);
      broadcastToChannel(channel!, {
        type: "live_error",
        fixtureId,
        message: err instanceof Error ? err.message : "live stream failed",
      });
    })
    .finally(() => {
      liveChannels.delete(fixtureId);
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

export function createWsServer(
  port: number,
  defaultOptions: ReplayOptions,
  liveDeps?: LiveDeps,
): WebSocketServer {
  const wss = new WebSocketServer({ port });
  wss.on("connection", (socket, req) => {
    const params = new URL(req.url ?? "/", "http://relay").searchParams;
    const liveFixtureId = params.get("live");
    const fixtureId = params.get("fixtureId");

    if (liveFixtureId) {
      if (!liveDeps) {
        console.log(`Live request for fixture ${liveFixtureId} — relay has no TxLINE credentials configured, closing`);
        socket.close(4005, "live mode not configured");
        return;
      }
      console.log(`Client connected (live: ${liveFixtureId})`);
      joinLiveChannel(liveFixtureId, liveDeps, socket);
      return;
    }

    if (!fixtureId) {
      console.log("Client connected (shared live/demo broadcast)");
      defaultBroadcastSockets.add(socket);
      socket.on("close", () => {
        defaultBroadcastSockets.delete(socket);
        console.log("Client disconnected");
      });
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
