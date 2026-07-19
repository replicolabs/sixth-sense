import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { NormalizedMatchEvent } from "@sixth-sense/shared";
import {
  normalizeFixtureSnapshot,
  normalizeScoresEvent,
  type RawFixtureSnapshotItem,
  type RawScoresEvent,
} from "@sixth-sense/txline";

interface CachedFixture {
  fixture: RawFixtureSnapshotItem;
  events: RawScoresEvent[];
}

function loadCachedFixture(fixtureId: string): CachedFixture {
  const path = fileURLToPath(new URL(`../../../fixtures/${fixtureId}.json`, import.meta.url));
  return JSON.parse(readFileSync(path, "utf8")) as CachedFixture;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ReplayOptions {
  /** Real-time-to-replay-time ratio. 40 means 40 real minutes -> 1 replay minute. */
  accelerationFactor?: number;
  /** How much real pre-kickoff coverage to include, compressed like everything else. */
  preKickoffLeadMinutes?: number;
}

/**
 * Re-emits a cached match's real events on an accelerated clock, preserving
 * real seq/ts/payloads exactly (CLAUDE.md Section 12) — only the WALL-CLOCK
 * delay between emissions is compressed, never the event content itself, so
 * any later stat-validation proof against these events stays valid.
 *
 * Full pre-match coverage in the raw feed can start literally days before
 * kickoff (observed: ~3.7 days of coverage_update/venue/pitch/lineup noise
 * for one real fixture) — replaying that at any speed would still mean
 * minutes of dead air, so the window starts a configurable lead-in before
 * the "kickoff" action rather than at the first cached event.
 */
export async function* replayFixture(
  fixtureId: string,
  options: ReplayOptions = {},
): AsyncGenerator<NormalizedMatchEvent> {
  const { accelerationFactor = 40, preKickoffLeadMinutes = 2 } = options;
  const cached = loadCachedFixture(fixtureId);
  const fixtureInfo = normalizeFixtureSnapshot(cached.fixture);

  const kickoff = cached.events.find((e) => e.Action === "kickoff");
  const windowStartTs = kickoff ? kickoff.Ts - preKickoffLeadMinutes * 60_000 : cached.events[0].Ts;
  const windowEvents = cached.events.filter((e) => e.Ts >= windowStartTs);

  let prevTs: number | null = null;
  for (const raw of windowEvents) {
    if (prevTs !== null) {
      const realDeltaMs = raw.Ts - prevTs;
      await sleep(Math.max(0, realDeltaMs / accelerationFactor));
    }
    prevTs = raw.Ts;
    yield normalizeScoresEvent(raw, fixtureInfo);
  }
}
