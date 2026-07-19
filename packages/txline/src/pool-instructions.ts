/**
 * Hand-built instruction/transaction construction for the ONE on-chain
 * action a normal user's own wallet ever has to sign directly: joining a
 * real-money pool (EXPANSION.md Section 4). Built by hand (discriminator
 * bytes lifted straight from the generated IDL, args borsh-encoded
 * manually) rather than pulling `@coral-xyz/anchor`'s `Program` class into
 * the browser bundle just for one instruction — every other on-chain
 * action in this app is server/service-wallet-signed and never runs
 * client-side at all.
 */
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import { SIXTH_SENSE_PROGRAM_ID, stakePda } from "./pool-pdas";

// sha256("global:join_pool")[0:8] — copied from target/idl/sixth_sense.json's
// generated discriminator, not re-derived, so it can never drift from the
// deployed program's real instruction layout.
const JOIN_POOL_DISCRIMINATOR = Buffer.from([14, 65, 62, 16, 116, 17, 195, 107]);

function buildJoinPoolInstruction(params: {
  user: PublicKey;
  poolConfig: PublicKey;
  vault: PublicKey;
  userTokenAccount: PublicKey;
  amount: bigint;
}): TransactionInstruction {
  const stakeAccount = stakePda(params.poolConfig, params.user);
  const data = Buffer.alloc(16);
  JOIN_POOL_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(params.amount, 8);

  return new TransactionInstruction({
    programId: SIXTH_SENSE_PROGRAM_ID,
    keys: [
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: params.poolConfig, isSigner: false, isWritable: true },
      { pubkey: stakeAccount, isSigner: false, isWritable: true },
      { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: params.vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Assembles a ready-to-sign (unsigned) join_pool transaction: creates the
 * user's associated token account first if it doesn't exist yet (a first-
 * time staker won't have one), so the whole flow is still just one
 * signature from the user's point of view.
 */
export async function buildJoinPoolTransaction(
  connection: Connection,
  params: {
    user: PublicKey;
    poolConfig: PublicKey;
    vault: PublicKey;
    tokenMint: PublicKey;
    amount: bigint;
  },
): Promise<Transaction> {
  const userTokenAccount = getAssociatedTokenAddressSync(params.tokenMint, params.user);
  const tx = new Transaction();

  const ataInfo = await connection.getAccountInfo(userTokenAccount);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        params.user,
        userTokenAccount,
        params.user,
        params.tokenMint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    );
  }

  tx.add(
    buildJoinPoolInstruction({
      user: params.user,
      poolConfig: params.poolConfig,
      vault: params.vault,
      userTokenAccount,
      amount: params.amount,
    }),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = params.user;

  return tx;
}

// sha256("global:claim_payout")[0:8], same provenance as JOIN_POOL_DISCRIMINATOR above.
const CLAIM_PAYOUT_DISCRIMINATOR = Buffer.from([127, 240, 132, 62, 227, 198, 146, 133]);

function buildClaimPayoutInstruction(params: {
  user: PublicKey;
  poolConfig: PublicKey;
  vault: PublicKey;
  userTokenAccount: PublicKey;
}): TransactionInstruction {
  const stakeAccount = stakePda(params.poolConfig, params.user);
  return new TransactionInstruction({
    programId: SIXTH_SENSE_PROGRAM_ID,
    keys: [
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: params.poolConfig, isSigner: false, isWritable: true },
      { pubkey: stakeAccount, isSigner: false, isWritable: true },
      { pubkey: params.vault, isSigner: false, isWritable: true },
      { pubkey: params.userTokenAccount, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: CLAIM_PAYOUT_DISCRIMINATOR,
  });
}

/**
 * Assembles a ready-to-sign claim_payout transaction. Unlike join_pool,
 * the user's ATA is guaranteed to already exist here (they had to have
 * one to stake in the first place), so there's no ATA-creation step.
 */
export async function buildClaimPayoutTransaction(
  connection: Connection,
  params: { user: PublicKey; poolConfig: PublicKey; vault: PublicKey; tokenMint: PublicKey },
): Promise<Transaction> {
  const userTokenAccount = getAssociatedTokenAddressSync(params.tokenMint, params.user);
  const tx = new Transaction().add(
    buildClaimPayoutInstruction({
      user: params.user,
      poolConfig: params.poolConfig,
      vault: params.vault,
      userTokenAccount,
    }),
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;
  tx.feePayer = params.user;

  return tx;
}
