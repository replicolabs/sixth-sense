/**
 * Sixth Sense relay service.
 *
 * Phase 2 scope (CLAUDE.md Section 16): serve a cached real match over
 * WebSocket on an accelerated clock — the always-on shared broadcast,
 * driven by REPLAY_FIXTURE_ID. Phase 7 (live mode) is no longer a
 * boot-time, single-fixture, restart-to-change toggle: any client can
 * request a real live match on demand via `?live=<fixtureId>` (see
 * ws-server.ts's on-demand live channels), as long as
 * TXLINE_SERVICE_WALLET_SECRET and TXLINE_SUBSCRIBE_TX_SIG are set. Both
 * the replay shared broadcast and on-demand live channels can run at the
 * same time — they no longer compete for one "mode".
 */
import { loadRootEnv } from "@sixth-sense/txline";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { createWsServer, startReplayBroadcast, type LiveDeps } from "./ws-server";

loadRootEnv();

function portFromWsUrl(url: string): number {
  return Number(new URL(url).port) || 8080;
}

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

function loadLiveDeps(): LiveDeps | undefined {
  const walletSecret = process.env.TXLINE_SERVICE_WALLET_SECRET;
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
  if (!walletSecret || !subscribeTxSig) {
    console.log(
      "TXLINE_SERVICE_WALLET_SECRET / TXLINE_SUBSCRIBE_TX_SIG not set — on-demand live matches " +
        "(?live=<fixtureId>) are disabled, but the replay shared broadcast and Classics still work.",
    );
    return undefined;
  }
  return { serviceWallet: loadServiceWallet(), subscribeTxSig };
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
  createWsServer(port, { accelerationFactor }, loadLiveDeps());

  const fixtureId = process.env.REPLAY_FIXTURE_ID;
  if (!fixtureId) {
    console.log(
      "REPLAY_FIXTURE_ID is not set — shared broadcast idle, but Classics sessions " +
        "(ws://.../?fixtureId=<id>) and live matches (ws://.../?live=<fixtureId>) still work.",
    );
    return;
  }

  startReplayBroadcast(fixtureId, { accelerationFactor });
}

main();
