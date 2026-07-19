/**
 * EXPANSION.md Section 4 pool lifecycle admin actions, mode-driven so the
 * three permissionless/admin steps after `create_pool` share one script:
 *
 *   MODE=lock POOL_ID_ONCHAIN=... pnpm --filter @sixth-sense/txline pool-admin
 *   MODE=record-scores POOL_ID_ONCHAIN=... CALL_RECORDS_JSON='[{"wallet":"...","callIds":[1]}]' \
 *     pnpm --filter @sixth-sense/txline pool-admin
 *   MODE=settle POOL_ID_ONCHAIN=... pnpm --filter @sixth-sense/txline pool-admin
 *
 * `record-scores` needs an explicit wallet -> call_id[] mapping because
 * there is no live settlement worker yet linking a user's off-chain
 * Prediction rows to the on-chain call_id they were settled under
 * (that's Phase 6/7 territory — session persistence + the live
 * settlement worker — neither built yet). This is a real gap, not
 * something faked here: every account this script touches and every
 * transaction it sends is real, it just needs that mapping supplied
 * until the missing link is built.
 */
import { PrismaClient } from "@sixth-sense/db";
import { AnchorProvider, Program, Wallet, BN, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import bs58 from "bs58";
import { loadRootEnv } from "./env";
import { callRecordPda, poolPda, resultPda, stakePda } from "./pool-pdas";
import sixthSenseIdl from "../../../target/idl/sixth_sense.json" with { type: "json" };

loadRootEnv();

function loadAdminWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET!;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

async function main() {
  const mode = process.env.MODE;
  const poolIdOnChain = process.env.POOL_ID_ONCHAIN;
  if (!mode || !poolIdOnChain) throw new Error("MODE and POOL_ID_ONCHAIN are required");

  const admin = loadAdminWallet();
  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program(sixthSenseIdl as Idl, provider);

  const poolId = new BN(poolIdOnChain);
  const pool = poolPda(poolId);

  const prisma = new PrismaClient();
  try {
    const dbPool = await prisma.pool.findUniqueOrThrow({ where: { poolIdOnChain } });

    if (mode === "lock") {
      const txSig = await program.methods.lockPool().accounts({ poolConfig: pool }).rpc();
      await prisma.pool.update({ where: { id: dbPool.id }, data: { status: "locked" } });
      console.log("Locked. txSig:", txSig);
      return;
    }

    if (mode === "record-scores") {
      const entries: { wallet: string; callIds: number[] }[] = JSON.parse(
        process.env.CALL_RECORDS_JSON ?? "[]",
      );
      for (const entry of entries) {
        const owner = new PublicKey(entry.wallet);
        const remainingAccounts = entry.callIds.map((callId) => ({
          pubkey: callRecordPda(owner, new BN(callId)),
          isWritable: false,
          isSigner: false,
        }));
        const txSig = await program.methods
          .recordPoolScore()
          .accounts({ poolConfig: pool, stakeAccount: stakePda(pool, owner) })
          .remainingAccounts(remainingAccounts)
          .rpc();
        console.log(`Scored ${entry.wallet}: txSig=${txSig}`);

        const stake = await (program.account as any).stakeAccount.fetch(stakePda(pool, owner));
        await prisma.stakeEntry.updateMany({
          where: { poolId: dbPool.id, stakeAccountAddress: stakePda(pool, owner).toBase58() },
          data: { poolPoints: BigInt(stake.poolPoints.toString()), scored: true },
        });
      }
      return;
    }

    if (mode === "settle") {
      const stakeEntries = await prisma.stakeEntry.findMany({ where: { poolId: dbPool.id } });
      const remainingAccounts = stakeEntries.map((e) => ({
        pubkey: new PublicKey(e.stakeAccountAddress),
        isWritable: true,
        isSigner: false,
      }));

      const txSig = await program.methods
        .settlePool()
        .accounts({
          payer: admin.publicKey,
          poolConfig: pool,
          poolResult: resultPda(pool),
          systemProgram: SystemProgram.programId,
        })
        .remainingAccounts(remainingAccounts)
        .rpc();
      console.log("Settled. txSig:", txSig);

      const result = await (program.account as any).poolResult.fetch(resultPda(pool));
      await prisma.pool.update({
        where: { id: dbPool.id },
        data: { status: result.cancelled ? "cancelled" : "settled" },
      });

      for (const entry of stakeEntries) {
        const stake = await (program.account as any).stakeAccount.fetch(new PublicKey(entry.stakeAccountAddress));
        await prisma.stakeEntry.update({
          where: { id: entry.id },
          data: { rank: stake.rank, payoutAmount: BigInt(stake.payoutAmount.toString()) },
        });
      }
      console.log(
        result.cancelled
          ? "Pool cancelled (under min participants) — full refunds recorded."
          : `Pool settled — ${result.paidCount} paid, rake=${result.rakeAmount.toString()}.`,
      );
      return;
    }

    throw new Error(`Unknown MODE: ${mode}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
