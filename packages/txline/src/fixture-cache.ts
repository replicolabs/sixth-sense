/**
 * Reads a fixture already cached to /fixtures (cache-fixture.ts/
 * archive-fixture.ts) — used by the settlement flow to determine real
 * proof parameters (final score, a safe seq) without needing a fresh
 * TxLINE historical fetch for every session-complete call.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { RawFixtureSnapshotItem, RawScoresEvent, RawStatValidationV1 } from "./raw";

export interface CachedFixture {
  fixture: RawFixtureSnapshotItem;
  events: RawScoresEvent[];
}

/**
 * `process.cwd()`-relative, NOT `import.meta.url`-relative — the latter
 * (used elsewhere for CLI scripts run directly via tsx, where it's a real
 * file:// URL) breaks once this module is bundled through Next.js's
 * Turbopack for an API route: a runtime, fixtureId-dependent path isn't
 * statically analyzable, so the bundler can't rewrite it and it resolves
 * against the wrong location (a real bug, caught by testing this route
 * against real cached fixture data). `process.cwd()` is a plain runtime
 * OS call, unaffected by bundling, and every workspace package/app this
 * runs from (apps/web, packages/txline) sits at the same depth under the
 * repo root, so `../../fixtures` from cwd is correct in both contexts.
 */
export function loadCachedFixtureEvents(fixtureId: string): CachedFixture {
  const path = resolve(process.cwd(), "../../fixtures", `${fixtureId}.json`);
  return JSON.parse(readFileSync(path, "utf8")) as CachedFixture;
}

/**
 * CLAUDE.md Phase 8 / Section 12: "verify at least one real on-chain proof
 * resolves for that match and cache the proof payload too." A match's
 * final-outcome proof only exists in TxLINE's historical window for
 * roughly two weeks — without this cache, the settlement worker's live
 * stat-validation fetch would start failing for the fixed demo match the
 * moment that window closes, breaking the Provably Fair badge at exactly
 * the wrong time (on stage). archive-fixture.ts already writes this file
 * for every archived Classics match; the settlement worker checks for it
 * before ever making a live TxLINE call.
 */
export function loadCachedProof(fixtureId: string): RawStatValidationV1 | null {
  const path = resolve(process.cwd(), "../../fixtures", `${fixtureId}-proof.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as RawStatValidationV1;
}

export interface FinalOutcomeProofParams {
  seq: number;
  statKey: number;
  finalGoals: number;
}

/**
 * Picks the winning side's total-goals stat (participant 1 on a draw) as
 * the real, provable "final match outcome" fact, and a seq a few events
 * before the very last one — the same "near the end, not literally the
 * last" pattern test-settle-call.ts found necessary for the stat-
 * validation endpoint to have a confirmed batch covering it.
 */
export function getFinalOutcomeProofParams(fixtureId: string): FinalOutcomeProofParams {
  const { events } = loadCachedFixtureEvents(fixtureId);
  const lastScored = [...events].reverse().find((e) => e.Score);
  const p1 = lastScored?.Score?.Participant1?.Total?.Goals ?? 0;
  const p2 = lastScored?.Score?.Participant2?.Total?.Goals ?? 0;
  const statKey = p2 > p1 ? 2 : 1;
  const finalGoals = p2 > p1 ? p2 : p1;
  const lastEvent = events[events.length - 1];
  const seq = Math.max(1, lastEvent.Seq - 4);
  return { seq, statKey, finalGoals };
}
