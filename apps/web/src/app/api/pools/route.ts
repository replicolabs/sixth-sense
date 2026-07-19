import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * EXPANSION.md Section 4.7: the Pools tab's list. Reads the off-chain
 * mirror (packages/db's Pool model) rather than fanning out RPC calls per
 * row — the chain stays authoritative for money, this is just for fast
 * browsing. BigInt fields are serialized as strings since JSON has no
 * 64-bit integer type.
 */
export async function GET() {
  const pools = await prisma.pool.findMany({
    orderBy: [{ weekStart: "asc" }],
  });

  return NextResponse.json({
    pools: pools.map((pool) => ({
      poolIdOnChain: pool.poolIdOnChain,
      gameweekLabel: pool.gameweekLabel,
      status: pool.status,
      weekStart: pool.weekStart,
      weekEnd: pool.weekEnd,
      minStake: pool.minStake.toString(),
      rakeBps: pool.rakeBps,
      paidPercentBps: pool.paidPercentBps,
      participantCount: pool.participantCount,
      totalStaked: pool.totalStaked.toString(),
      tokenMint: pool.tokenMint,
    })),
  });
}
