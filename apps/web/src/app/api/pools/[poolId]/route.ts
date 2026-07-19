import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * Pool detail + standings (EXPANSION.md Section 4.7: "live pool standings"
 * and the settlement screen both read this). `poolId` in the URL is the
 * on-chain `poolIdOnChain`, not the DB row's cuid — it's what the rest of
 * the app (join flow, chain lookups) already has on hand.
 *
 * Ranking rule for `entries` ordering: once ranks exist (settled or
 * cancelled) sort by rank; while the gameweek is live (locked, scores
 * trickling in via record_pool_score) sort by poolPoints so standings
 * feel like a real live leaderboard; before that, newest joiners last.
 */
export async function GET(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const privyId = new URL(request.url).searchParams.get("privyId");

  const pool = await prisma.pool.findUnique({
    where: { poolIdOnChain: poolId },
    include: {
      entries: {
        include: { user: { select: { id: true, privyId: true, nickname: true } } },
      },
    },
  });

  if (!pool) {
    return NextResponse.json({ error: "pool not found" }, { status: 404 });
  }

  const sortedEntries = [...pool.entries].sort((a, b) => {
    if (pool.status === "settled" || pool.status === "cancelled") {
      return (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER);
    }
    if (pool.status === "locked") {
      return Number(b.poolPoints - a.poolPoints);
    }
    return a.joinedAt.getTime() - b.joinedAt.getTime();
  });

  return NextResponse.json({
    pool: {
      poolIdOnChain: pool.poolIdOnChain,
      poolConfigAddress: pool.poolConfigAddress,
      vaultAddress: pool.vaultAddress,
      tokenMint: pool.tokenMint,
      gameweekLabel: pool.gameweekLabel,
      status: pool.status,
      weekStart: pool.weekStart,
      weekEnd: pool.weekEnd,
      minStake: pool.minStake.toString(),
      rakeBps: pool.rakeBps,
      paidPercentBps: pool.paidPercentBps,
      minParticipants: pool.minParticipants,
      participantCount: pool.participantCount,
      totalStaked: pool.totalStaked.toString(),
    },
    entries: sortedEntries.map((entry, index) => ({
      nickname: entry.user.nickname,
      isMe: privyId ? entry.user.privyId === privyId : false,
      amountStaked: entry.amountStaked.toString(),
      poolPoints: entry.poolPoints.toString(),
      rank: entry.rank ?? (pool.status === "locked" ? index + 1 : null),
      payoutAmount: entry.payoutAmount?.toString() ?? null,
      claimed: entry.claimed,
    })),
  });
}
