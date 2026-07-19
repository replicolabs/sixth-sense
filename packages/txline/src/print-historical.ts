/**
 * Phase 1 ship criterion (CLAUDE.md Section 16): "a page that shows real,
 * normalized match events." This is the CLI version — fetches one real
 * fixture's historical events and prints them normalized. The web page
 * version calls the same client/normalize functions from apps/web.
 *
 * Usage: FIXTURE_ID=12345 pnpm --filter @sixth-sense/txline print-historical
 *
 * Requires a live TxLINE session: run `pnpm --filter @sixth-sense/txline
 * subscribe` once first (needs TXLINE_SERVICE_WALLET_SECRET with devnet
 * SOL), then this script performs guest/start + token/activate itself using
 * the resulting txSig.
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrActivateSession } from "./auth";
import { getFixturesSnapshot, getScoresHistorical } from "./client";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";
import { normalizeFixtureSnapshot, normalizeScoresEvent } from "./normalize";

loadRootEnv();

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  const trimmed = raw.trim();
  return trimmed.startsWith("[")
    ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(trimmed)))
    : Keypair.fromSecretKey(bs58.decode(trimmed));
}

async function main() {
  const config = loadTxLineConfig();
  const serviceWallet = loadServiceWallet();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
  const fixtureId = process.env.FIXTURE_ID;

  if (!subscribeTxSig) {
    throw new Error(
      "TXLINE_SUBSCRIBE_TX_SIG is not set. Run the subscribe script first and paste its txSig here.",
    );
  }
  if (!fixtureId) {
    throw new Error("FIXTURE_ID is not set. Pick one from getFixturesSnapshot() output.");
  }

  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  const startEpochDay = process.env.START_EPOCH_DAY
    ? Number(process.env.START_EPOCH_DAY)
    : undefined;
  const snapshot = await getFixturesSnapshot(config, session, { startEpochDay });
  const rawFixture = snapshot.find((f) => String(f.FixtureId) === fixtureId);
  if (!rawFixture) {
    throw new Error(`Fixture ${fixtureId} not found in current fixtures/snapshot window`);
  }
  const fixtureInfo = normalizeFixtureSnapshot(rawFixture);

  console.log(
    `${fixtureInfo.participant1} vs ${fixtureInfo.participant2} (${fixtureInfo.competition})`,
  );

  const rawEvents = await getScoresHistorical(config, session, fixtureId);
  console.log(`${rawEvents.length} historical events`);

  for (const raw of rawEvents) {
    const normalized = normalizeScoresEvent(raw, fixtureInfo);
    console.log(JSON.stringify(normalized.update, null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
