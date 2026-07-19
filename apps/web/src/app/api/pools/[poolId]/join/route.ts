import { prisma } from "@sixth-sense/db";
import { confirmTransactionSucceeded, fetchStakeAccountOnChain, stakePda } from "@sixth-sense/txline";
import { PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";

/**
 * Called by the client right after it submits and confirms a real
 * `join_pool` transaction (task: client-side signing via the user's Privy
 * embedded wallet). This endpoint never trusts the client's claimed
 * amount — it re-reads the actual `StakeAccount` from chain and mirrors
 * whatever it finds there, so the off-chain Pool/StakeEntry rows can never
 * drift from what the vault actually holds.
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
  if (!stake) {
    return NextResponse.json({ error: "StakeAccount not found on chain yet — try again shortly" }, { status: 409 });
  }

  const stakeAccountAddress = stakePda(
    new PublicKey(pool.poolConfigAddress),
    new PublicKey(user.walletAddress),
  ).toBase58();
  const existing = await prisma.stakeEntry.findUnique({
    where: { poolId_userId: { poolId: pool.id, userId: user.id } },
  });

  if (existing) {
    return NextResponse.json({ alreadyJoined: true, amountStaked: existing.amountStaked.toString() });
  }

  await prisma.$transaction([
    prisma.stakeEntry.create({
      data: {
        poolId: pool.id,
        userId: user.id,
        stakeAccountAddress,
        amountStaked: stake.amountStaked,
        poolPoints: stake.poolPoints,
        scored: stake.scored,
      },
    }),
    prisma.pool.update({
      where: { id: pool.id },
      data: {
        participantCount: { increment: 1 },
        totalStaked: { increment: stake.amountStaked },
      },
    }),
  ]);

  return NextResponse.json({ joined: true, amountStaked: stake.amountStaked.toString() });
}
