/**
 * Replay Mode infrastructure (CLAUDE.md Section 12): caches a real match's
 * fixture metadata + full historical event list to /fixtures so the relay's
 * replay engine can re-emit it without depending on the historical endpoint
 * staying available (it only serves ~2 weeks to 6 hours old per CLAUDE.md).
 *
 * Usage: FIXTURE_ID=18241006 START_EPOCH_DAY=20648 pnpm --filter @sixth-sense/txline cache-fixture
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrActivateSession } from "./auth";
import { getFixturesSnapshot, getScoresHistorical } from "./client";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";

loadRootEnv();

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

async function main() {
  const config = loadTxLineConfig();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
  const fixtureId = process.env.FIXTURE_ID;
  if (!subscribeTxSig) throw new Error("TXLINE_SUBSCRIBE_TX_SIG is not set");
  if (!fixtureId) throw new Error("FIXTURE_ID is not set");

  const startEpochDay = process.env.START_EPOCH_DAY
    ? Number(process.env.START_EPOCH_DAY)
    : undefined;

  const serviceWallet = loadServiceWallet();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  const snapshot = await getFixturesSnapshot(config, session, { startEpochDay });
  const rawFixture = snapshot.find((f) => String(f.FixtureId) === fixtureId);
  if (!rawFixture) {
    throw new Error(`Fixture ${fixtureId} not found in fixtures/snapshot (try START_EPOCH_DAY)`);
  }

  const rawEvents = await getScoresHistorical(config, session, fixtureId);
  console.log(
    `${rawFixture.Participant1} vs ${rawFixture.Participant2} (${rawFixture.Competition}): ${rawEvents.length} events`,
  );

  const fixturesDir = fileURLToPath(new URL("../../../fixtures", import.meta.url));
  mkdirSync(fixturesDir, { recursive: true });
  const outPath = join(fixturesDir, `${fixtureId}.json`);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({ fixture: rawFixture, events: rawEvents }, null, 2));
  console.log(`Cached to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
