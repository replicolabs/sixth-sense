/**
 * Read-only on-chain lookups for EXPANSION.md Section 4's staking pools —
 * used by the web app's join-sync endpoint to verify a client-submitted
 * join_pool transaction actually happened, rather than trusting whatever
 * amount the client claims to have staked.
 */
import { AnchorProvider, Program, Wallet, type Idl } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { stakePda } from "./pool-pdas";
import sixthSenseIdl from "../../../target/idl/sixth_sense.json" with { type: "json" };

export interface OnChainStakeAccount {
  pool: string;
  owner: string;
  amountStaked: bigint;
  poolPoints: bigint;
  scored: boolean;
  rank: number;
  payoutAmount: bigint;
  claimed: boolean;
}

function readonlyProgram(rpcUrl: string): Program {
  const connection = new Connection(rpcUrl, "confirmed");
  // Read-only lookups never sign anything, so any keypair works as the
  // AnchorProvider's nominal wallet.
  const provider = new AnchorProvider(connection, new Wallet(Keypair.generate()), { commitment: "confirmed" });
  return new Program(sixthSenseIdl as Idl, provider);
}

export async function fetchStakeAccountOnChain(
  rpcUrl: string,
  poolConfigAddress: string,
  ownerAddress: string,
): Promise<OnChainStakeAccount | null> {
  const program = readonlyProgram(rpcUrl);
  const pool = new PublicKey(poolConfigAddress);
  const owner = new PublicKey(ownerAddress);
  const pda = stakePda(pool, owner);
  try {
    const stake = await (program.account as any).stakeAccount.fetch(pda);
    return {
      pool: (stake.pool as PublicKey).toBase58(),
      owner: (stake.owner as PublicKey).toBase58(),
      amountStaked: BigInt(stake.amountStaked.toString()),
      poolPoints: BigInt(stake.poolPoints.toString()),
      scored: stake.scored as boolean,
      rank: stake.rank as number,
      payoutAmount: BigInt(stake.payoutAmount.toString()),
      claimed: stake.claimed as boolean,
    };
  } catch {
    return null;
  }
}

export async function confirmTransactionSucceeded(rpcUrl: string, txSig: string): Promise<boolean> {
  const connection = new Connection(rpcUrl, "confirmed");
  const tx = await connection.getTransaction(txSig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  return tx !== null && tx.meta?.err == null;
}
