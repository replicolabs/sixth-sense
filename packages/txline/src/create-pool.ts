/**
 * EXPANSION.md Section 4: admin-only weekly pool creation. Calls the real
 * on-chain `create_pool` instruction, then mirrors the new pool into
 * Postgres so the Pools UI has something fast to list/browse (the chain
 * stays the source of truth for money; see packages/db's Pool model doc).
 *
 * Usage:
 *   TOKEN_MINT=... GAMEWEEK_LABEL="Premier League — Matchday 12" \
 *   FIXTURE_IDS=18241006,18237038 \
 *   WEEK_START=2026-07-25T14:00:00Z WEEK_END=2026-07-27T20:00:00Z \
 *   MIN_STAKE=5000000 RAKE_BPS=800 MIN_PARTICIPANTS=20 \
 *   CURVE_K_X100=150 PAID_PERCENT_BPS=2000 \
 *   pnpm --filter @sixth-sense/txline create-pool
 */
import { PrismaClient } from "@sixth-sense/db";
import anchorPkg from "@coral-xyz/anchor";
import type { Idl } from "@coral-xyz/anchor";
const { AnchorProvider, Program, Wallet, BN } = anchorPkg;
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { loadRootEnv } from "./env";
import { poolPda, vaultPda } from "./pool-pdas";
import sixthSenseIdl from "../../../target/idl/sixth_sense.json" with { type: "json" };

loadRootEnv();

function loadAdminWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET!;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function main() {
  const admin = loadAdminWallet();
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program(sixthSenseIdl as Idl, provider);

  const tokenMint = new PublicKey(requireEnv("TOKEN_MINT"));
  const gameweekLabel = requireEnv("GAMEWEEK_LABEL");
  const fixtureIds = requireEnv("FIXTURE_IDS").split(",").map((s) => s.trim());
  const weekStart = new Date(requireEnv("WEEK_START"));
  const weekEnd = new Date(requireEnv("WEEK_END"));
  const minStake = BigInt(process.env.MIN_STAKE ?? "5000000");
  const rakeBps = Number(process.env.RAKE_BPS ?? 800);
  const minParticipants = Number(process.env.MIN_PARTICIPANTS ?? 20);
  const curveKX100 = Number(process.env.CURVE_K_X100 ?? 150);
  const paidPercentBps = Number(process.env.PAID_PERCENT_BPS ?? 2000);
  const poolId = new BN(process.env.POOL_ID ?? Date.now());

  const pool = poolPda(poolId);
  const vault = vaultPda(pool);

  console.log(`Creating pool ${poolId.toString()} (${gameweekLabel})...`);
  const txSig = await program.methods
    .createPool(
      poolId,
      new BN(minStake.toString()),
      rakeBps,
      minParticipants,
      curveKX100,
      paidPercentBps,
      new BN(Math.floor(weekStart.getTime() / 1000)),
      new BN(Math.floor(weekEnd.getTime() / 1000)),
      fixtureIds.map((id) => new BN(id)),
    )
    .accounts({
      admin: admin.publicKey,
      poolConfig: pool,
      tokenMint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("On-chain pool created. txSig:", txSig);
  console.log("PoolConfig:", pool.toBase58(), "Vault:", vault.toBase58());

  const prisma = new PrismaClient();
  try {
    await prisma.pool.create({
      data: {
        poolIdOnChain: poolId.toString(),
        poolConfigAddress: pool.toBase58(),
        vaultAddress: vault.toBase58(),
        tokenMint: tokenMint.toBase58(),
        gameweekLabel,
        minStake,
        rakeBps,
        minParticipants,
        curveKX100,
        paidPercentBps,
        weekStart,
        weekEnd,
        fixtureIds,
        status: "open",
        participantCount: 0,
        totalStaked: 0n,
      },
    });
    console.log("Mirrored into Postgres.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
