import { prisma, type UnlockSource } from "@sixth-sense/db";
import { CLUB_KIT_CATALOG, nextStreak, type UnlockConditionType } from "@sixth-sense/shared";
import { getFinalOutcomeProofParams, settleFinalOutcome } from "@sixth-sense/txline";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { NextResponse } from "next/server";

const CONDITION_TO_SOURCE: Record<UnlockConditionType, UnlockSource> = {
  sessionStreak: "streak",
  lifetimeWins: "wins",
  matchesPlayed: "matchesPlayed",
  xpLevel: "xp",
};

interface SubmittedPrediction {
  cardType: string;
  question: string;
  choice: "yes" | "no" | null;
  windowStartSeq: number;
  windowEndTs: number;
  resolvedSeq: number;
  basePoints: number;
  multiplier: number;
  awardedPoints: number;
  outcome: "win" | "loss" | "void";
}

function loadServiceWallet(): Keypair | null {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET;
  if (!raw) return null;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

/**
 * Phase 6's missing foundation: this is the ONE place a session's
 * predictions become real Postgres rows, the ONE place lifetime points
 * actually accumulate, and the trigger for the settlement floor
 * (CLAUDE.md Section 9) — a real on-chain proof of the match's final
 * outcome, via packages/txline's settlement-worker.ts. Recomputes
 * bestStreak/callsMade/callsWon/pointsTotal from the submitted prediction
 * list server-side (via the same nextStreak used client-side) rather than
 * trusting client-supplied aggregates.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { privyId, fixtureId, mode, predictions } = body as {
    privyId?: string;
    fixtureId?: string;
    mode?: "live" | "replay";
    predictions?: SubmittedPrediction[];
  };

  if (!privyId || !fixtureId || !mode || !predictions) {
    return NextResponse.json({ error: "privyId, fixtureId, mode, and predictions are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json({ error: "user not found — sync login first" }, { status: 404 });
  }

  let streak = 0;
  let bestStreak = 0;
  let pointsTotal = 0;
  let callsMade = 0;
  let callsWon = 0;
  for (const p of predictions) {
    if (p.choice !== null) callsMade += 1;
    if (p.outcome === "win") callsWon += 1;
    pointsTotal += p.awardedPoints;
    streak = nextStreak(streak, p.outcome);
    bestStreak = Math.max(bestStreak, streak);
  }

  const matchSession = await prisma.matchSession.create({
    data: {
      userId: user.id,
      fixtureId,
      mode,
      endedAt: new Date(),
      pointsTotal,
      bestStreak,
      callsMade,
      callsWon,
      predictions: {
        create: predictions.map((p) => ({
          userId: user.id,
          fixtureId,
          cardType: p.cardType,
          question: p.question,
          choice: p.choice ?? undefined,
          windowStartSeq: p.windowStartSeq,
          windowEndTs: BigInt(p.windowEndTs),
          resolvedSeq: p.resolvedSeq,
          outcome: p.outcome,
          basePoints: p.basePoints,
          multiplier: p.multiplier,
          awardedPoints: p.awardedPoints,
        })),
      },
    },
    include: { predictions: true },
  });

  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      lifetimePoints: user.lifetimePoints + pointsTotal,
      bestStreak: Math.max(user.bestStreak, bestStreak),
      lifetimeWins: user.lifetimeWins + callsWon,
      lifetimeMatchesPlayed: user.lifetimeMatchesPlayed + 1,
    },
  });

  const alreadyUnlocked = await prisma.kitUnlock.findMany({
    where: { userId: user.id },
    select: { kitId: true },
  });
  const unlockedIds = new Set(alreadyUnlocked.map((k) => k.kitId));

  const statFor = (type: UnlockConditionType) => {
    switch (type) {
      case "sessionStreak":
        return bestStreak;
      case "lifetimeWins":
        return updatedUser.lifetimeWins;
      case "matchesPlayed":
        return updatedUser.lifetimeMatchesPlayed;
      case "xpLevel":
        return updatedUser.level;
    }
  };

  const newlyUnlockedKitIds: string[] = [];
  for (const kit of CLUB_KIT_CATALOG) {
    if (unlockedIds.has(kit.id)) continue;
    if (statFor(kit.unlock.type) >= kit.unlock.threshold) {
      await prisma.kitUnlock.create({
        data: { userId: user.id, kitId: kit.id, unlockedVia: CONDITION_TO_SOURCE[kit.unlock.type] },
      });
      newlyUnlockedKitIds.push(kit.id);
    }
  }

  // Settlement floor (CLAUDE.md Section 9): one real on-chain proof of the
  // match's final outcome per session, anchoring the "Provably Fair"
  // badge. Only possible once the fixture's events are cached locally
  // (cache-fixture.ts/archive-fixture.ts) — for a live session before a
  // live-mode cache exists (Phase 7), this is skipped rather than faked.
  let settlement: { status: "proven" | "failed" | "skipped"; txSig?: string } = { status: "skipped" };
  const serviceWallet = loadServiceWallet();
  if (serviceWallet && process.env.TXLINE_SUBSCRIBE_TX_SIG) {
    try {
      const { seq, statKey, finalGoals } = getFinalOutcomeProofParams(fixtureId);
      const result = await settleFinalOutcome({
        serviceWallet,
        playerWalletAddress: user.walletAddress,
        fixtureId,
        seq,
        statKey,
        finalGoals,
        // call_id only needs to be unique per owner (CallRecord PDA seeds
        // are [CALL_SEED, owner_pubkey, call_id]) — current-ms timestamp
        // is more than sufficient for one player's sequential sessions.
        callId: BigInt(Date.now()),
        awardedPoints: pointsTotal,
      });
      settlement = { status: result.provenOutcome ? "proven" : "failed", txSig: result.txSig };
    } catch (err) {
      console.error("Settlement worker failed:", err);
      settlement = { status: "failed" };
    }
  }

  if (settlement.status !== "skipped") {
    await prisma.prediction.updateMany({
      where: { sessionId: matchSession.id },
      data: {
        settlementStatus: settlement.status === "proven" ? "proven" : "failed",
        settlementSig: settlement.txSig ?? null,
      },
    });
  }

  return NextResponse.json({
    sessionId: matchSession.id,
    pointsTotal,
    callsMade,
    callsWon,
    accuracy: callsMade > 0 ? callsWon / callsMade : 0,
    bestStreak,
    lifetimePoints: updatedUser.lifetimePoints,
    newlyUnlockedKitIds,
    settlement,
  });
}
