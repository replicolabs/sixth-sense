/**
 * Integration test for the sixth-sense Anchor program's settle_call,
 * exercising a REAL CPI into TxOracle's validate_stat with a REAL Merkle
 * proof fetched from TxLINE.
 *
 * Usage:
 *   pnpm --filter @sixth-sense/txline test-settle-call
 *     -> local Surfnet (Surfpool forking devnet, TxOracle program cloned
 *        in via `surfnet_cloneProgramAccount`) — costs nothing, fast
 *        iteration. Start it first: `surfpool start --network devnet --yes`
 *
 *   TEST_RPC_URL=https://api.devnet.solana.com pnpm --filter @sixth-sense/txline test-settle-call
 *     -> real devnet. Costs real (test) SOL for fees.
 */
import { AnchorProvider, Program, Wallet, BN, type Idl } from "@coral-xyz/anchor";
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

const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const SIXTH_SENSE_PROGRAM_ID = new PublicKey("5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9");

function loadServiceWallet(): Keypair {
  const raw = process.env.TXLINE_SERVICE_WALLET_SECRET!;
  return Keypair.fromSecretKey(bs58.decode(raw.trim()));
}

// Test player is a fresh throwaway keypair, funded from the local Surfnet's
// generous default airdrop behavior isn't automatic for arbitrary new
// keys, so we airdrop it explicitly below.
const player = Keypair.generate();

async function main() {
  const config = loadTxLineConfig();
  const serviceWallet = loadServiceWallet();
  const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG!;
  const session = await getOrActivateSession(config, subscribeTxSig, serviceWallet);

  // Real fixture, real seq, real stat key — England vs Argentina, final
  // score 1-2, key 2 = participant2 (Argentina) total goals.
  const fixtureId = "18241006";
  const seq = 960;
  const statKey = 2;
  const proof = await getStatValidationV1(config, session, { fixtureId, seq, statKey });

  console.log("Real proof fetched:", {
    ts: proof.ts,
    statToProve: proof.statToProve,
    statProofLen: proof.statProof.length,
    subTreeProofLen: proof.subTreeProof.length,
    mainTreeProofLen: proof.mainTreeProof.length,
  });

  const rpcUrl = process.env.TEST_RPC_URL ?? "http://127.0.0.1:8899";
  console.log("Using RPC:", rpcUrl);
  const connection = new Connection(rpcUrl, "confirmed");

  // Real devnet's airdrop faucet is frequently rate-limited or down; fall
  // back to a direct transfer from our already-funded service wallet
  // rather than depending on it.
  try {
    const airdropSig = await connection.requestAirdrop(player.publicKey, 2_000_000_000);
    await connection.confirmTransaction(airdropSig, "confirmed");
  } catch (err) {
    console.log("Airdrop failed, funding player from the service wallet instead:", (err as Error).message);
    const transferTx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: serviceWallet.publicKey,
        toPubkey: player.publicKey,
        lamports: 2_000_000_000,
      }),
    );
    await connection.sendTransaction(transferTx, [serviceWallet], { skipPreflight: false });
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const provider = new AnchorProvider(connection, new Wallet(player), { commitment: "confirmed" });
  const program = new Program(sixthSenseIdl as Idl, provider);

  const [userRecordPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("user"), player.publicKey.toBuffer()],
    SIXTH_SENSE_PROGRAM_ID,
  );

  console.log("Initializing user...");
  await program.methods
    .initUser()
    .accounts({
      payer: player.publicKey,
      owner: player.publicKey,
      userRecord: userRecordPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("UserRecord created:", userRecordPda.toBase58());

  // TxOracle's validate_stat expects `ts` to equal
  // summary.updateStats.minTimestamp — confirmed by trial against the real
  // program: both the proof envelope's own top-level `ts` and
  // updateStats.maxTimestamp throw AnchorError TimestampMismatch
  // ("the timestamp provided for seed generation does not match the
  // timestamp in the snapshot payload"); minTimestamp is the one value
  // that actually validates. Not documented anywhere — found by testing.
  const validateTs = proof.summary.updateStats.minTimestamp;
  // epoch_day = floor(ts_ms / 86_400_000), PDA seeds confirmed against the
  // real txodds/tx-on-chain TypeScript examples (not documented in CLAUDE.md).
  const epochDay = Math.floor(validateTs / 86_400_000);
  const epochDayBuf = Buffer.alloc(2);
  epochDayBuf.writeUInt16LE(epochDay);
  const [dailyScoresRootsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("daily_scores_roots"), epochDayBuf],
    TXORACLE_PROGRAM_ID,
  );
  console.log("daily_scores_merkle_roots PDA:", dailyScoresRootsPda.toBase58(), "epochDay:", epochDay);

  const callId = new BN(1);

  // Map the HTTP API's field names onto the on-chain instruction's
  // argument names — they differ (subTreeProof -> fixture_proof) even
  // though they're the same Merkle proof concept; see raw.ts's comment
  // for why.
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
    statToProve: {
      key: proof.statToProve.key,
      value: proof.statToProve.value,
      period: proof.statToProve.period,
    },
    eventStatRoot: Array.from(toBytes(proof.eventStatRoot)),
    statProof: toProofNodes(proof.statProof),
  };

  // Predicate: "participant2's total goals == 2" — true given the real
  // final score. Set TEST_FALSE_CLAIM=1 to deliberately claim the wrong
  // outcome and confirm settle_call records it as a loss (not an error) —
  // claimed_outcome vs proven_outcome are compared, never rejected outright.
  const predicate = { threshold: 2, comparison: { equalTo: {} } };
  const claimedOutcome = process.env.TEST_FALSE_CLAIM !== "1";
  const awardedPoints = new BN(100);

  const computeBudgetIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 });

  console.log("Calling settle_call with real proof data...");
  const txSig = await program.methods
    .settleCall(
      callId,
      new BN(fixtureId),
      new BN(validateTs),
      fixtureSummary,
      toProofNodes(proof.subTreeProof), // -> fixture_proof
      toProofNodes(proof.mainTreeProof), // -> main_tree_proof
      predicate,
      statA,
      null, // stat_b
      null, // op
      claimedOutcome,
      awardedPoints,
    )
    .accounts({
      settler: player.publicKey,
      userRecord: userRecordPda,
      callRecord: PublicKey.findProgramAddressSync(
        [Buffer.from("call"), player.publicKey.toBuffer(), callId.toArrayLike(Buffer, "le", 8)],
        SIXTH_SENSE_PROGRAM_ID,
      )[0],
      txoracleProgram: TXORACLE_PROGRAM_ID,
      dailyScoresMerkleRoots: dailyScoresRootsPda,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([computeBudgetIx])
    .rpc();

  console.log("settle_call txSig:", txSig);

  const userRecord = await (program.account as any).userRecord.fetch(userRecordPda);
  console.log("UserRecord after settle:", {
    points: userRecord.points.toString(),
    wins: userRecord.wins,
    losses: userRecord.losses,
    currentStreak: userRecord.currentStreak,
    bestStreak: userRecord.bestStreak,
  });
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
