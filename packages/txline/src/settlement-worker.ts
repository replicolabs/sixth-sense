/**
 * CLAUDE.md Section 9's settlement floor: "Minimum: settle only the final
 * match outcome... Never drop below this floor." Settling every resolved
 * card in real time isn't feasible here (each on-chain validate_stat CPI
 * needs its own real TxLINE proof fetch plus a ~1.4M CU transaction), so
 * this settles ONE real, on-chain-proven fact per finished session: the
 * match's actual final score for the winning side (or participant 1 on a
 * draw), via the same validate_stat CPI path test-settle-call.ts already
 * proved works. This is the anchor the "Provably Fair" badge points at —
 * it proves the match result was real and on-chain, not that every
 * individual card the player saw was separately settled. That distinction
 * is intentional and documented, not hidden.
 *
 * The settler is always the service wallet (CLAUDE.md Section 8: "the
 * service can be an authorized settler that writes results" so the
 * player's device never blocks on a signature) — but the UserRecord PDA
 * this settles under is keyed to the PLAYER's own wallet address, via
 * init_user's payer/owner split (payer = service wallet if the player has
 * no UserRecord yet, owner = the player).
 */
import { AnchorProvider, Program, Wallet, BN, type Idl } from "@coral-xyz/anchor";
import { ComputeBudgetProgram, Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { getOrActivateSession } from "./auth";
import { getStatValidationV1 } from "./client";
import { loadTxLineConfig } from "./config";
import { loadCachedProof } from "./fixture-cache";
import sixthSenseIdl from "../../../target/idl/sixth_sense.json" with { type: "json" };

const SIXTH_SENSE_PROGRAM_ID = new PublicKey("5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9");
const TXORACLE_PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

function userRecordPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("user"), owner.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}
function callRecordPda(owner: PublicKey, callId: bigint): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("call"), owner.toBuffer(), new BN(callId.toString()).toArrayLike(Buffer, "le", 8)],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}

export interface SettleFinalOutcomeParams {
  serviceWallet: Keypair;
  playerWalletAddress: string;
  fixtureId: string;
  /** A seq near the end of the historical stream, known to carry the confirmed final score. */
  seq: number;
  /** 1 or 2 — whichever participant's final goal tally is being proven. */
  statKey: number;
  /** The real final goal count for that participant — what we're claiming is true. */
  finalGoals: number;
  /** Unique per player (e.g. derived from the MatchSession's id). */
  callId: bigint;
  awardedPoints: number;
}

export interface SettleFinalOutcomeResult {
  txSig: string;
  provenOutcome: boolean;
}

async function ensureUserRecord(
  program: Program,
  connection: Connection,
  serviceWallet: Keypair,
  owner: PublicKey,
): Promise<void> {
  const pda = userRecordPda(owner);
  const existing = await connection.getAccountInfo(pda);
  if (existing) return;

  await program.methods
    .initUser()
    .accounts({
      payer: serviceWallet.publicKey,
      owner,
      userRecord: pda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
}

/**
 * Fetches a stat-validation proof (a cached one if archive-fixture.ts
 * already captured one for this fixture — CLAUDE.md Phase 8/Section 12:
 * "cache the proof payload too" — otherwise a live TxLINE fetch) and
 * settles it on-chain. Throws on any real failure — callers (the
 * session-complete API route) decide how to surface that
 * (SettlementStatus.failed, retry later, etc.) rather than this function
 * silently swallowing errors. Using the cache first matters most for the
 * fixed demo match: TxLINE's historical window is only ~2 weeks, so a
 * live-only fetch would start failing well before any actual demo/judging
 * session, breaking the Provably Fair badge at exactly the wrong moment.
 */
export async function settleFinalOutcome(params: SettleFinalOutcomeParams): Promise<SettleFinalOutcomeResult> {
  const cached = loadCachedProof(params.fixtureId);
  const proof =
    cached ??
    (await (async () => {
      const config = loadTxLineConfig();
      const subscribeTxSig = process.env.TXLINE_SUBSCRIBE_TX_SIG;
      if (!subscribeTxSig) throw new Error("TXLINE_SUBSCRIBE_TX_SIG is not set");
      const session = await getOrActivateSession(config, subscribeTxSig, params.serviceWallet);
      return getStatValidationV1(config, session, {
        fixtureId: params.fixtureId,
        seq: params.seq,
        statKey: params.statKey,
      });
    })());

  const rpcUrl = process.env.SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");
  const provider = new AnchorProvider(connection, new Wallet(params.serviceWallet), { commitment: "confirmed" });
  const program = new Program(sixthSenseIdl as Idl, provider);

  const owner = new PublicKey(params.playerWalletAddress);
  await ensureUserRecord(program, connection, params.serviceWallet, owner);

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
  const predicate = { threshold: params.finalGoals, comparison: { equalTo: {} } };

  const txSig = await program.methods
    .settleCall(
      new BN(params.callId.toString()),
      new BN(params.fixtureId),
      new BN(validateTs),
      fixtureSummary,
      toProofNodes(proof.subTreeProof),
      toProofNodes(proof.mainTreeProof),
      predicate,
      statA,
      null,
      null,
      true, // we're claiming the real final score, which is true by construction
      new BN(params.awardedPoints),
    )
    .accounts({
      settler: params.serviceWallet.publicKey,
      userRecord: userRecordPda(owner),
      callRecord: callRecordPda(owner, params.callId),
      txoracleProgram: TXORACLE_PROGRAM_ID,
      dailyScoresMerkleRoots: dailyScoresRootsPda,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 })])
    .rpc();

  const callRecord = await (program.account as any).callRecord.fetch(callRecordPda(owner, params.callId));
  return { txSig, provenOutcome: callRecord.provenOutcome as boolean };
}
