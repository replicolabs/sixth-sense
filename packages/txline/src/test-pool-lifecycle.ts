/**
 * Integration test for EXPANSION.md Section 4's staking pool instructions
 * (create_pool/join_pool/lock_pool/record_pool_score/settle_pool/
 * claim_payout), against real devnet — real SPL token transfers, real
 * PDAs, real CallRecords settled via a real TxOracle proof (the same real
 * fixture/proof test-settle-call.ts already exercises).
 *
 * Usage: TEST_RPC_URL=https://api.devnet.solana.com \
 *   pnpm --filter @sixth-sense/txline test-pool-lifecycle
 */
import { AnchorProvider, Program, Wallet, BN, type Idl } from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getOrActivateSession } from "./auth";
import { getStatValidationV1 } from "./client";
import { loadTxLineConfig } from "./config";
import { loadRootEnv } from "./env";
import sixthSenseIdl from "../../../target/idl/sixth_sense.json" with { type: "json" };

loadRootEnv();

const SIXTH_SENSE_PROGRAM_ID = new PublicKey("5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9");
const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET!;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

async function fundWithSol(connection: Connection, serviceWallet: Keypair, to: PublicKey, lamports: number) {
  try {
    const sig = await connection.requestAirdrop(to, lamports);
    await connection.confirmTransaction(sig, "confirmed");
  } catch {
    const tx = new Transaction().add(
      SystemProgram.transfer({ fromPubkey: serviceWallet.publicKey, toPubkey: to, lamports }),
    );
    await connection.sendTransaction(tx, [serviceWallet], { skipPreflight: false });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function poolPda(poolId: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolId.toArrayLike(Buffer, "le", 8)],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}
function vaultPda(pool: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), pool.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}
function stakePda(pool: PublicKey, owner: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), pool.toBuffer(), owner.toBuffer()],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}
function resultPda(pool: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("result"), pool.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}
function userRecordPda(owner: PublicKey) {
  return PublicKey.findProgramAddressSync([Buffer.from("user"), owner.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}
function callRecordPda(owner: PublicKey, callId: BN) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("call"), owner.toBuffer(), callId.toArrayLike(Buffer, "le", 8)],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}

async function settleRealCallFor(
  program: Program,
  player: Keypair,
  proof: Awaited<ReturnType<typeof getStatValidationV1>>,
  awardedPoints: number,
) {
  const validateTs = proof.summary.updateStats.minTimestamp;
  const epochDay = Math.floor(validateTs / 86_400_000);
  const epochDayBuf = Buffer.alloc(2);
  epochDayBuf.writeUInt16LE(epochDay);
  const [dailyScoresRootsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochDayBuf],
    TXORACLE_PROGRAM_ID,
  );

  const toBytes = (arr: number[]) => Buffer.from(arr);
  const toProofNodes = (nodes: { hash: number[]; isRightSibling: boolean }[]) =>
    nodes.map((n) => ({ hash: Array.from(toBytes(n.hash)), isRightSibling: n.isRightSibling }));

  const fixtureSummary = {
    fixtureId: new BN(proof.summary.fixtureId),
    updateStats: {
      updateCount: proof.summary.updateStats.updateCount,
      minTimestamp: new BN(proof.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(proof.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: Array.from(toBytes(proof.summary.eventStatsSubTreeRoot)),
  };
  const statA = {
    statToProve: { key: proof.statToProve.key, value: proof.statToProve.value, period: proof.statToProve.period },
    eventStatRoot: Array.from(toBytes(proof.eventStatRoot)),
    statProof: toProofNodes(proof.statProof),
  };
  const predicate = { threshold: 2, comparison: { equalTo: {} } };
  const callId = new BN(1);

  await program.methods
    .initUser()
    .accounts({
      payer: player.publicKey,
      owner: player.publicKey,
      userRecord: userRecordPda(player.publicKey),
      systemProgram: SystemProgram.programId,
    })
    .signers([player])
    .rpc();

  await program.methods
    .settleCall(
      callId,
      new BN(proof.summary.fixtureId),
      new BN(validateTs),
      fixtureSummary,
      toProofNodes(proof.subTreeProof),
      toProofNodes(proof.mainTreeProof),
      predicate,
      statA,
      null,
      null,
      true, // claimed_outcome — real final score matches (Argentina scored exactly 2)
      new BN(awardedPoints),
    )
    .accounts({
      settler: player.publicKey,
      userRecord: userRecordPda(player.publicKey),
      callRecord: callRecordPda(player.publicKey, callId),
      txoracleProgram: TXORACLE_PROGRAM_ID,
      dailyScoresMerkleRoots: dailyScoresRootsPda,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .signers([player])
    .rpc();

  return callRecordPda(player.publicKey, callId);
}

async function main() {
  const config = loadTxLineConfig();
  const serviceWallet = loadServiceWallet();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG!;
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  const fixtureId = "18241006";
  const proof = await getStatValidationV1(config, session, { fixtureId, seq: 960, statKey: 2 });
  console.log("Real proof fetched for fixture", fixtureId);

  const rpcUrl = process.env.TEST_RPC_URL ?? "http://127.0.0.1:8899";
  const connection = new Connection(rpcUrl, "confirmed");

  const admin = serviceWallet; // create_pool's ADMIN_PUBKEY == this wallet
  const players = [Keypair.generate(), Keypair.generate(), Keypair.generate()];

  console.log("Funding 3 test players with SOL...");
  for (const p of players) {
    await fundWithSol(connection, serviceWallet, p.publicKey, 500_000_000);
  }

  console.log("Creating a fresh test SPL mint...");
  const mint = await createMint(connection, serviceWallet, serviceWallet.publicKey, null, 6);
  console.log("Test mint:", mint.toBase58());

  const playerAtas: PublicKey[] = [];
  for (const p of players) {
    const ata = await getOrCreateAssociatedTokenAccount(connection, serviceWallet, mint, p.publicKey);
    await mintTo(connection, serviceWallet, mint, ata.address, serviceWallet, 100_000_000); // 100 tokens
    playerAtas.push(ata.address);
  }
  console.log("Minted 100 test tokens to each player.");

  const adminProvider = new AnchorProvider(connection, new Wallet(admin), { commitment: "confirmed" });
  const program = new Program(sixthSenseIdl as Idl, adminProvider);
  const playerPrograms = players.map(
    (p) => new Program(sixthSenseIdl as Idl, new AnchorProvider(connection, new Wallet(p), { commitment: "confirmed" })),
  );

  // Distinct awarded_points per player -> distinct pool_points -> a real ranking.
  console.log("Settling one real (proven) call per player with different awarded_points...");
  const callRecords: PublicKey[] = [];
  const points = [300, 200, 100];
  for (let i = 0; i < players.length; i++) {
    const cr = await settleRealCallFor(playerPrograms[i], players[i], proof, points[i]);
    callRecords.push(cr);
    console.log(`  player${i + 1} settled with awardedPoints=${points[i]}`);
  }

  // ---- Pool 1: normal settlement path (3 participants, pay top 67%) ----
  const poolId = new BN(Date.now());
  const pool = poolPda(poolId);
  const vault = vaultPda(pool);
  const now = Math.floor(Date.now() / 1000);
  const weekStart = now + 8;
  const weekEnd = now + 16;

  console.log("\n=== Pool 1: normal settlement path ===");
  console.log("create_pool...");
  await program.methods
    .createPool(
      poolId,
      new BN(5_000_000), // min stake: 5 tokens
      800, // 8% rake
      2, // min participants
      150, // k = 1.5
      6667, // pay top 66.67% (2 of 3)
      new BN(weekStart),
      new BN(weekEnd),
      [new BN(fixtureId)],
    )
    .accounts({
      admin: admin.publicKey,
      poolConfig: pool,
      tokenMint: mint,
      vault,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Pool created:", pool.toBase58());

  console.log("join_pool for all 3 players (10 tokens each)...");
  for (let i = 0; i < players.length; i++) {
    await playerPrograms[i].methods
      .joinPool(new BN(10_000_000))
      .accounts({
        user: players[i].publicKey,
        poolConfig: pool,
        stakeAccount: stakePda(pool, players[i].publicKey),
        userTokenAccount: playerAtas[i],
        vault,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }
  console.log("All 3 joined.");

  console.log(`Waiting for week_start (${weekStart - Math.floor(Date.now() / 1000)}s)...`);
  await sleep(Math.max(0, weekStart - Math.floor(Date.now() / 1000) + 2) * 1000);

  console.log("lock_pool...");
  await program.methods.lockPool().accounts({ poolConfig: pool }).rpc();

  console.log("record_pool_score for all 3 players...");
  for (let i = 0; i < players.length; i++) {
    await program.methods
      .recordPoolScore()
      .accounts({ poolConfig: pool, stakeAccount: stakePda(pool, players[i].publicKey) })
      .remainingAccounts([{ pubkey: callRecords[i], isWritable: false, isSigner: false }])
      .rpc();
  }
  console.log("All 3 scored.");

  console.log(`Waiting for week_end (${weekEnd - Math.floor(Date.now() / 1000)}s)...`);
  await sleep(Math.max(0, weekEnd - Math.floor(Date.now() / 1000) + 2) * 1000);

  console.log("settle_pool...");
  await program.methods
    .settlePool()
    .accounts({ payer: admin.publicKey, poolConfig: pool, poolResult: resultPda(pool), systemProgram: SystemProgram.programId })
    .remainingAccounts(players.map((p) => ({ pubkey: stakePda(pool, p.publicKey), isWritable: true, isSigner: false })))
    .rpc();

  const poolResult = await (program.account as any).poolResult.fetch(resultPda(pool));
  console.log("PoolResult:", {
    totalPool: poolResult.totalPool.toString(),
    rakeAmount: poolResult.rakeAmount.toString(),
    distributablePot: poolResult.distributablePot.toString(),
    paidCount: poolResult.paidCount,
    cancelled: poolResult.cancelled,
  });

  let payoutSum = new BN(0);
  for (let i = 0; i < players.length; i++) {
    const stake = await (program.account as any).stakeAccount.fetch(stakePda(pool, players[i].publicKey));
    console.log(`  player${i + 1} (points=${points[i]}): rank=${stake.rank} payout=${stake.payoutAmount.toString()}`);
    payoutSum = payoutSum.add(stake.payoutAmount);
  }
  console.log(
    "Sum of payouts == distributablePot:",
    payoutSum.toString() === poolResult.distributablePot.toString(),
  );

  console.log("claim_payout for all 3 players...");
  for (let i = 0; i < players.length; i++) {
    const before = await getAccount(connection, playerAtas[i]);
    await playerPrograms[i].methods
      .claimPayout()
      .accounts({
        user: players[i].publicKey,
        poolConfig: pool,
        stakeAccount: stakePda(pool, players[i].publicKey),
        vault,
        userTokenAccount: playerAtas[i],
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc();
    const after = await getAccount(connection, playerAtas[i]);
    console.log(`  player${i + 1} balance ${before.amount} -> ${after.amount}`);
  }

  // ---- Pool 2: under-minParticipants refund path ----
  console.log("\n=== Pool 2: under-minParticipants refund path ===");
  const poolId2 = new BN(Date.now() + 1);
  const pool2 = poolPda(poolId2);
  const vault2 = vaultPda(pool2);
  const now2 = Math.floor(Date.now() / 1000);
  const weekStart2 = now2 + 8;
  const weekEnd2 = now2 + 16;

  await program.methods
    .createPool(
      poolId2,
      new BN(1_000_000),
      800,
      5, // min participants — only 1 will join, forcing cancellation
      150,
      2000,
      new BN(weekStart2),
      new BN(weekEnd2),
      [new BN(fixtureId)],
    )
    .accounts({
      admin: admin.publicKey,
      poolConfig: pool2,
      tokenMint: mint,
      vault: vault2,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  await playerPrograms[0].methods
    .joinPool(new BN(4_000_000))
    .accounts({
      user: players[0].publicKey,
      poolConfig: pool2,
      stakeAccount: stakePda(pool2, players[0].publicKey),
      userTokenAccount: playerAtas[0],
      vault: vault2,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("Only player1 joined pool 2 (below min_participants=5).");

  await sleep(Math.max(0, weekStart2 - Math.floor(Date.now() / 1000) + 2) * 1000);
  await program.methods.lockPool().accounts({ poolConfig: pool2 }).rpc();

  await program.methods
    .recordPoolScore()
    .accounts({ poolConfig: pool2, stakeAccount: stakePda(pool2, players[0].publicKey) })
    .remainingAccounts([{ pubkey: callRecords[0], isWritable: false, isSigner: false }])
    .rpc();

  await sleep(Math.max(0, weekEnd2 - Math.floor(Date.now() / 1000) + 2) * 1000);

  await program.methods
    .settlePool()
    .accounts({ payer: admin.publicKey, poolConfig: pool2, poolResult: resultPda(pool2), systemProgram: SystemProgram.programId })
    .remainingAccounts([{ pubkey: stakePda(pool2, players[0].publicKey), isWritable: true, isSigner: false }])
    .rpc();

  const poolResult2 = await (program.account as any).poolResult.fetch(resultPda(pool2));
  const stake2 = await (program.account as any).stakeAccount.fetch(stakePda(pool2, players[0].publicKey));
  console.log("Pool 2 cancelled:", poolResult2.cancelled, "refund amount:", stake2.payoutAmount.toString(), "staked:", stake2.amountStaked.toString());

  const beforeRefund = await getAccount(connection, playerAtas[0]);
  await playerPrograms[0].methods
    .claimPayout()
    .accounts({
      user: players[0].publicKey,
      poolConfig: pool2,
      stakeAccount: stakePda(pool2, players[0].publicKey),
      vault: vault2,
      userTokenAccount: playerAtas[0],
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .rpc();
  const afterRefund = await getAccount(connection, playerAtas[0]);
  console.log(`Refund claimed: ${beforeRefund.amount} -> ${afterRefund.amount}`);

  console.log("\nAll pool lifecycle tests completed.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
