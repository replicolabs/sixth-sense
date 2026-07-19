/**
 * PDA derivation helpers shared by the pool admin scripts and
 * test-pool-lifecycle.ts — kept in one place so the seed bytes
 * (programs/sixth-sense/src/pool_constants.rs) only need to match Rust in
 * a single spot on the TS side.
 */
import type { BN } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

export const SIXTH_SENSE_PROGRAM_ID = new PublicKey("5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9");

export function poolPda(poolId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("pool"), poolId.toArrayLike(Buffer, "le", 8)],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}

export function vaultPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault"), pool.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}

export function stakePda(pool: PublicKey, owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), pool.toBuffer(), owner.toBuffer()],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}

export function resultPda(pool: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("result"), pool.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}

export function userRecordPda(owner: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("user"), owner.toBuffer()], SIXTH_SENSE_PROGRAM_ID)[0];
}

export function callRecordPda(owner: PublicKey, callId: BN): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("call"), owner.toBuffer(), callId.toArrayLike(Buffer, "le", 8)],
    SIXTH_SENSE_PROGRAM_ID,
  )[0];
}
