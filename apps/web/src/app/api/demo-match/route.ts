// Imported from these specific subpaths, not the "@sixth-sense/txline"
// package root. See apps/web/src/app/api/fixtures/live/route.ts for why:
// the root barrel also re-exports Anchor-dependent modules that crash under
// Vercel's runtime with ERR_REQUIRE_ESM, and this route never touches Anchor.
import { getOrActivateSession } from "@sixth-sense/txline/auth";
import { getFixturesSnapshot, getScoresHistorical } from "@sixth-sense/txline/client";
import { loadTxLineConfig } from "@sixth-sense/txline/config";
import { normalizeFixtureSnapshot, normalizeScoresEvent } from "@sixth-sense/txline/normalize";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";

// Server-only route. The browser never sees TXLINE_SERVICE_WALLET_SECRET or
// talks to TxLINE directly (CLAUDE.md Section 5, "key rules").
export const dynamic = "force-dynamic";

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) throw new Error("TXLINE_SERVICE_WALLET_SECRET is not set");
  const trimmed = raw.trim();
  return trimmed.startsWith("[")
    ? Keypair.fromSecretKey(new Uint8Array(JSON.parse(trimmed)))
    : Keypair.fromSecretKey(bs58.decode(trimmed));
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const fixtureId = params.get("fixtureId");
  const startEpochDayParam = params.get("startEpochDay");
  const startEpochDay = startEpochDayParam ? Number(startEpochDayParam) : undefined;
  if (!fixtureId) {
    return NextResponse.json({ error: "fixtureId query param is required" }, { status: 400 });
  }

  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
  if (!subscribeTxSig) {
    return NextResponse.json(
      {
        error:
          "TXLINE_SUBSCRIBE_TX_SIG is not set. Run `pnpm --filter @sixth-sense/txline subscribe` once, then set its txSig in .env.",
      },
      { status: 503 },
    );
  }

  try {
    const config = loadTxLineConfig();
    const serviceWallet = loadServiceWallet();
    const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

    const snapshot = await getFixturesSnapshot(config, session, { startEpochDay });
    const rawFixture = snapshot.find((f) => String(f.FixtureId) === fixtureId);
    if (!rawFixture) {
      return NextResponse.json(
        { error: `Fixture ${fixtureId} not found in current fixtures/snapshot window` },
        { status: 404 },
      );
    }
    const fixtureInfo = normalizeFixtureSnapshot(rawFixture);

    const rawEvents = await getScoresHistorical(config, session, fixtureId);
    const events = rawEvents.map((raw) => normalizeScoresEvent(raw, fixtureInfo).update);

    return NextResponse.json({ fixtureInfo, events });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
