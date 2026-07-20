// Imported from these specific subpaths, not the "@sixth-sense/txline"
// package root, deliberately. The root barrel (src/index.ts) re-exports
// pool-chain.ts and settlement-worker.ts too, which pull in @coral-xyz/anchor.
// Anchor is marked serverExternalPackages in next.config.ts (needed by the
// pool routes), which means Vercel's runtime require()s it raw instead of
// bundling it, and its rpc-websockets dependency then fails with
// ERR_REQUIRE_ESM trying to require() the ESM-only uuid package. This route
// never touches Anchor, so it must not import anything that does.
import { getFixturesSnapshot } from "@sixth-sense/txline/client";
import { getOrActivateSession } from "@sixth-sense/txline/auth";
import { loadTxLineConfig } from "@sixth-sense/txline/config";
import { normalizeFixtureSnapshot } from "@sixth-sense/txline/normalize";
import type { FixtureInfo } from "@sixth-sense/shared";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";

// Generous enough to cover 90 minutes + stoppage + extra time + penalties
// for a knockout match, without needing to know the real match status
// (fixtures/snapshot carries no status/live flag at all — confirmed
// against the real endpoint, see packages/txline/src/raw.ts's
// RawFixtureSnapshotItem). A match is "live" here if it kicked off in the
// past but not more than this long ago.
const LIVE_WINDOW_MS = 150 * 60 * 1000;
// No cap on how far ahead an upcoming match can be. TxLINE's fixture
// snapshot already isn't limited to one competition (confirmed against
// real devnet data: it returns friendlies alongside World Cup fixtures
// with no filtering needed), and the fixtures it happens to return can sit
// months out, so any window here would just hide real matches for no
// reason. If the list ever gets too long to be useful, revisit this.

function loadServiceWallet(): Keypair | null {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) return null;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

/**
 * Real fixture discovery for the home screen (CLAUDE.md Section 11.2's
 * original spec — "A list of matches: live matches first... Pulled from
 * `/api/fixtures/snapshot`" — which the build had shortcut around with a
 * single hardcoded LIVE_FIXTURE_ID env var). The browser never talks to
 * TxLINE directly (Section 5); this route does it server-side, same
 * pattern as settlement-worker.ts's callers.
 */
export async function GET() {
  const serviceWallet = loadServiceWallet();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;

  if (!serviceWallet || !subscribeTxSig) {
    return NextResponse.json({ configured: false, live: [], upcoming: [] });
  }

  const config = loadTxLineConfig();
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);
  const snapshot = await getFixturesSnapshot(config, session, {});
  const fixtures = snapshot.map(normalizeFixtureSnapshot);

  const now = Date.now();
  const live: FixtureInfo[] = [];
  const upcoming: FixtureInfo[] = [];

  for (const fixture of fixtures) {
    const startMs = new Date(fixture.startTime).getTime();
    const sinceStart = now - startMs;
    if (sinceStart >= 0 && sinceStart <= LIVE_WINDOW_MS) {
      live.push(fixture);
    } else if (sinceStart < 0) {
      upcoming.push(fixture);
    }
  }

  live.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  upcoming.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  return NextResponse.json({ configured: true, live, upcoming });
}
