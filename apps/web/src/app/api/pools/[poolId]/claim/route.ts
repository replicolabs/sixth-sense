import { prisma } from "@sixth-sense/db";
import { confirmTransactionSucceeded, fetchStakeAccountOnChain } from "@sixth-sense/txline";
import { NextResponse } from "next/server";

/**
 * Mirrors a confirmed claim_payout transaction — same "never trust the
 * client's number" approach as the join endpoint: re-reads the actual
 * StakeAccount.claimed flag from chain rather than trusting the request.
 */
export async function POST(request: Request, { params }: { params: Promise<{ poolId: string }> }) {
  const { poolId } = await params;
  const body = await request.json();
  const { privyId, txSig } = body as { privyId?: string; txSig?: string };

  if (!privyId || !txSig) {
    return NextResponse.json({ error: "privyId and txSig are required" }, { status: 400 });
  }

  const [pool, user] = await Promise.all([
    prisma.pool.findUnique({ where: { poolIdOnChain: poolId } }),
    prisma.user.findUnique({ where: { privyId } }),
  ]);
  if (!pool) return NextResponse.json({ error: "pool not found" }, { status: 404 });
  if (!user) return NextResponse.json({ error: "user not found — sync login first" }, { status: 404 });

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";

  const succeeded = await confirmTransactionSucceeded(rpcUrl, txSig);
  if (!succeeded) {
    return NextResponse.json({ error: "transaction not found or failed" }, { status: 400 });
  }

  const stake = await fetchStakeAccountOnChain(rpcUrl, pool.poolConfigAddress, user.walletAddress);
  if (!stake || !stake.claimed) {
    return NextResponse.json({ error: "claim not confirmed on chain yet — try again shortly" }, { status: 409 });
  }

  await prisma.stakeEntry.updateMany({
    where: { poolId: pool.id, userId: user.id },
    data: { claimed: true },
  });

  return NextResponse.json({ claimed: true, payoutAmount: stake.payoutAmount.toString() });
}
