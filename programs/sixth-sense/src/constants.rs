use anchor_lang::prelude::*;

#[constant]
pub const USER_SEED: &[u8] = b"user";

#[constant]
pub const CALL_SEED: &[u8] = b"call";

/// TxOracle's daily Merkle root PDA seed (confirmed against the real
/// txodds/tx-on-chain TypeScript examples, not guessed — it is NOT
/// documented in CLAUDE.md beyond "epoch-day derived, u16 little-endian").
#[constant]
pub const DAILY_SCORES_ROOTS_SEED: &[u8] = b"daily_scores_roots";

/// TxOracle devnet program id (CLAUDE.md Section 6.2). This build targets
/// devnet only, per CLAUDE.md Section 9 ("devnet for the build and demo") —
/// a mainnet deployment would need this constant (and the deployed
/// program's own address) to point at TxOracle's mainnet program instead.
pub const TXORACLE_PROGRAM_ID: Pubkey = pubkey!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
