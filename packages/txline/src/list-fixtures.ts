/**
 * Diagnostic: lists fixtures currently visible in /api/fixtures/snapshot,
 * so you can pick a real FIXTURE_ID to smoke-test print-historical against.
 *
 * Usage: pnpm --filter @sixth-sense/txline list-fixtures
 */
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrActivateSession } from "./auth";
import { getFixturesSnapshot } from "./client";
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
  if (!subscribeTxSig) throw new Error("TXLINE_SUBSCRIBE_TX_SIG is not set");

  const serviceWallet = loadServiceWallet();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  const startEpochDay = process.env.START_EPOCH_DAY
    ? Number(process.env.START_EPOCH_DAY)
    : undefined;
  const snapshot = await getFixturesSnapshot(config, session, { startEpochDay });
  console.log(`${snapshot.length} fixtures (startEpochDay=${startEpochDay ?? "default"})`);
  for (const f of snapshot.slice(0, 30)) {
    console.log(
      `${f.FixtureId}  ${f.Participant1} vs ${f.Participant2}  (${f.Competition})  raw StartTime=${f.StartTime}  as-seconds=${new Date(f.StartTime * 1000).toISOString()}  as-ms=${new Date(f.StartTime).toISOString()}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
