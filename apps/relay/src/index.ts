/**
 * Sixth Sense relay service.
 *
 * Phase 2 scope (CLAUDE.md Section 16): serve a cached real match over
 * WebSocket on an accelerated clock. Phase 7: LIVE_FIXTURE_ID switches the
 * shared broadcast to the real live TxLINE stream instead — mutually
 * exclusive with REPLAY_FIXTURE_ID (only one shared broadcast runs at a
 * time; Classics sessions work off cached fixtures regardless of which
 * mode the shared broadcast is in).
 */
import { loadRootEnv } from "@sixth-sense/txline";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createWsServer, startLiveBroadcast, startReplayBroadcast } from "./ws-server";

loadRootEnv();

function portFromWsUrl(url: string): number {
  return Number(new URL(url).port) || 8080;
}

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

function main() {
  // Railway (and most PaaS hosts) assign a port dynamically via `PORT` and
  // expect the app to bind to exactly that — it doesn't match whatever
  // port RELAY_WS_URL happens to say, so PORT wins whenever it's set.
  // Local dev has no PORT env var, so RELAY_WS_URL's port is still used
  // unchanged there.
  const port = process.env.PORT ? Number(process.env.PORT) : portFromWsUrl(process.env.RELAY_WS_URL ?? "ws://localhost:8080");
  const accelerationFactor = Number(process.env.REPLAY_ACCELERATION ?? 40);
  // Same acceleration factor drives both the shared broadcast and any
  // per-connection Classics session (?fixtureId=<id>) — see ws-server.ts.
  const wss = createWsServer(port, { accelerationFactor });

  const liveFixtureId = process.env.LIVE_FIXTURE_ID;
  if (liveFixtureId) {
    const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
    if (!subscribeTxSig) throw new Error("TXLINE_SUBSCRIBE_TX_SIG is not set");
    startLiveBroadcast(wss, liveFixtureId, loadServiceWallet(), subscribeTxSig);
    return;
  }

  const fixtureId = process.env.REPLAY_FIXTURE_ID;
  if (!fixtureId) {
    console.log(
      "Neither LIVE_FIXTURE_ID nor REPLAY_FIXTURE_ID is set — shared broadcast idle, but Classics " +
        "sessions (ws://.../?fixtureId=<id>) still work off cached fixtures.",
    );
    return;
  }

  startReplayBroadcast(wss, fixtureId, { accelerationFactor });
}

main();
