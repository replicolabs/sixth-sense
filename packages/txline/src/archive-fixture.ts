/**
 * EXPANSION.md Section 2.3: captures a real match's full event stream (via
 * the same logic as cache-fixture.ts) plus a representative real
 * stat-validation proof, and inserts an ArchivedMatch row so it's
 * findable in the Classics shelf. Must run before TxLINE's historical
 * window closes (~2 weeks to 6 hours old).
 *
 * Usage: FIXTURE_ID=18241006 START_EPOCH_DAY=20648 TAGS=comeback,derby \
 *   pnpm --filter @sixth-sense/txline archive-fixture
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@sixth-sense/db";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { getOrActivateSession } from "./auth";
import { getFixturesSnapshot, getScoresHistorical, getStatValidationV1 } from "./client";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";
import type { RawFixtureSnapshotItem, RawScoresEvent } from "./raw";

loadRootEnv();

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

function fixturesDir(): string {
  return fileURLToPath(new URL("../../../fixtures", import.meta.url));
}

async function main() {
  const config = loadTxLineConfig();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
  const fixtureId = process.env.FIXTURE_ID;
  if (!subscribeTxSig) throw new Error("TXLINE_SUBSCRIBE_TX_SIG is not set");
  if (!fixtureId) throw new Error("FIXTURE_ID is not set");
  const startEpochDay = process.env.START_EPOCH_DAY ? Number(process.env.START_EPOCH_DAY) : undefined;
  const manualTags = (process.env.TAGS ?? "").split(",").map((t) => t.trim()).filter(Boolean);

  const serviceWallet = loadServiceWallet();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  const dir = fixturesDir();
  mkdirSync(dir, { recursive: true });
  const eventsPath = `${dir}/${fixtureId}.json`;

  let rawFixture: RawFixtureSnapshotItem;
  let rawEvents: RawScoresEvent[];

  if (existsSync(eventsPath)) {
    console.log(`Reusing already-cached event stream at ${eventsPath}`);
    const cached = JSON.parse(readFileSync(eventsPath, "utf8"));
    rawFixture = cached.fixture;
    rawEvents = cached.events;
  } else {
    const snapshot = await getFixturesSnapshot(config, session, { startEpochDay });
    const found = snapshot.find((f) => String(f.FixtureId) === fixtureId);
    if (!found) throw new Error(`Fixture ${fixtureId} not found in fixtures/snapshot (try START_EPOCH_DAY)`);
    rawFixture = found;
    rawEvents = await getScoresHistorical(config, session, fixtureId);
    writeFileSync(eventsPath, JSON.stringify({ fixture: rawFixture, events: rawEvents }, null, 2));
    console.log(`Cached event stream to ${eventsPath}`);
  }

  console.log(
    `${rawFixture.Participant1} vs ${rawFixture.Participant2} (${rawFixture.Competition}): ${rawEvents.length} events`,
  );

  // Final score, read off the last event that actually carries a Score payload.
  const lastScored = [...rawEvents].reverse().find((e) => e.Score);
  const p1Score = lastScored?.Score?.Participant1?.Total?.Goals ?? 0;
  const p2Score = lastScored?.Score?.Participant2?.Total?.Goals ?? 0;

  // Prove the winning side's total-goals stat as representative evidence
  // that this archive is real and provable — not every possible card
  // predicate, just proof the capability is real (Section 2.3).
  const winningParticipantStatKey = p2Score > p1Score ? 2 : 1;
  const nearEndEvent = rawEvents[rawEvents.length - 1];
  const proofSeq = Math.max(1, nearEndEvent.Seq - 4);
  const proof = await getStatValidationV1(config, session, {
    fixtureId,
    seq: proofSeq,
    statKey: winningParticipantStatKey,
  });
  const proofPath = `${dir}/${fixtureId}-proof.json`;
  writeFileSync(proofPath, JSON.stringify(proof, null, 2));
  console.log(`Cached representative proof to ${proofPath} (statKey=${winningParticipantStatKey})`);

  const prisma = new PrismaClient();
  try {
    const kickoffDate = new Date(rawFixture.StartTime);
    const autoTags = [
      Math.abs(p1Score - p2Score) <= 1 ? "close-match" : null,
      p1Score + p2Score >= 4 ? "high-scoring" : null,
    ].filter((t): t is string => t !== null);

    const archived = await prisma.archivedMatch.upsert({
      where: { fixtureId: String(fixtureId) },
      update: {
        participant1Score: p1Score,
        participant2Score: p2Score,
        eventStreamRef: `fixtures/${fixtureId}.json`,
        proofsRef: `fixtures/${fixtureId}-proof.json`,
        tags: [...new Set([...autoTags, ...manualTags])],
      },
      create: {
        fixtureId: String(fixtureId),
        competition: rawFixture.Competition,
        competitionId: String(rawFixture.CompetitionId),
        season: String(kickoffDate.getUTCFullYear()),
        participant1: rawFixture.Participant1,
        participant2: rawFixture.Participant2,
        participant1Score: p1Score,
        participant2Score: p2Score,
        kickoffDate,
        eventStreamRef: `fixtures/${fixtureId}.json`,
        proofsRef: `fixtures/${fixtureId}-proof.json`,
        tags: [...new Set([...autoTags, ...manualTags])],
      },
    });
    console.log("Archived:", archived.id, archived.participant1, "vs", archived.participant2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
