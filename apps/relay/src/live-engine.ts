/**
 * CLAUDE.md Phase 7 / Section 6.5: the real live path. `/api/scores/stream`
 * is one global firehose covering whatever's live — this filters it down
 * to one specific fixture per call. ws-server.ts's on-demand live channels
 * call this once per distinct fixture actually being watched (not once
 * per user), so multiple simultaneous live matches are supported without
 * multiplying TxLINE stream connections per viewer.
 *
 * Ordering, dedupe, and recovery per Section 6.5: track seq, drop
 * anything not strictly greater, and on a detected gap re-hydrate from
 * `/api/scores/snapshot/{fixtureId}` before resuming the live feed.
 */
import {
  normalizeFixtureSnapshot,
  normalizeScoresEvent,
  consumeScoresStream,
  getFixturesSnapshot,
  getScoresSnapshot,
  getOrActivateSession,
  loadTxLineConfig,
  type TxLineConfig,
  type TxLineSession,
} from "@sixth-sense/txline";
import type { FixtureInfo, NormalizedMatchEvent } from "@sixth-sense/shared";
import type { Keypair } from "@solana/web3.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function resolveFixtureInfo(
  config: TxLineConfig,
  session: TxLineSession,
  fixtureId: string,
): Promise<FixtureInfo> {
  const snapshot = await getFixturesSnapshot(config, session, {});
  const found = snapshot.find((f) => String(f.FixtureId) === fixtureId);
  if (!found) throw new Error(`Live fixture ${fixtureId} not found in fixtures/snapshot`);
  return normalizeFixtureSnapshot(found);
}

/**
 * Looks up a fixture without opening the live stream — used to tell an
 * on-demand live channel (ws-server.ts) whether the fixture the user
 * picked exists and has actually kicked off yet, before committing to a
 * long-lived stream connection for it.
 */
export async function checkLiveFixture(
  fixtureId: string,
  serviceWallet: Keypair,
  subscribeTxSig: string,
): Promise<FixtureInfo> {
  const config = loadTxLineConfig();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);
  return resolveFixtureInfo(config, session, fixtureId);
}

/**
 * Re-emits real live events for one fixture, forever — reconnects on any
 * stream error (network drop, server hiccup) after a short backoff, and
 * transparently rehydrates from a snapshot whenever a seq gap is
 * detected, so a consumer downstream (the card engine / WS broadcast)
 * never has to know the difference between live and replay.
 */
export async function* liveFixtureEvents(
  fixtureId: string,
  serviceWallet: Keypair,
  subscribeTxSig: string,
): AsyncGenerator<NormalizedMatchEvent> {
  const config = loadTxLineConfig();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);
  const fixtureInfo = await resolveFixtureInfo(config, session, fixtureId);
  const fixtureIdNum = Number(fixtureId);

  let lastSeq = 0;

  for (;;) {
    const controller = new AbortController();
    try {
      for await (const msg of consumeScoresStream(config, session, controller.signal)) {
        if (msg.type === "heartbeat") continue;
        if (msg.event.FixtureId !== fixtureIdNum) continue; // demux the global firehose down to our featured fixture

        if (msg.event.Seq <= lastSeq) continue; // dedupe (Section 6.5)

        if (lastSeq !== 0 && msg.event.Seq > lastSeq + 1) {
          console.log(`Live: seq gap for fixture ${fixtureId} (had ${lastSeq}, got ${msg.event.Seq}) — rehydrating from snapshot`);
          const snapshotEvents = await getScoresSnapshot(config, session, fixtureId);
          const missed = snapshotEvents.filter((e) => e.Seq > lastSeq).sort((a, b) => a.Seq - b.Seq);
          for (const snapEvent of missed) {
            lastSeq = snapEvent.Seq;
            yield normalizeScoresEvent(snapEvent, fixtureInfo);
          }
          if (msg.event.Seq <= lastSeq) continue; // the current message was already covered by the snapshot
        }

        lastSeq = msg.event.Seq;
        yield normalizeScoresEvent(msg.event, fixtureInfo);
      }
      // Stream ended cleanly (server closed it) — reconnect.
      console.log(`Live stream for fixture ${fixtureId} ended — reconnecting in 3s`);
    } catch (err) {
      console.error(`Live stream for fixture ${fixtureId} dropped — reconnecting in 3s:`, err);
    }
    await sleep(3000);
  }
}
