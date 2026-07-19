use anchor_lang::prelude::*;

#[constant]
pub const POOL_SEED: &[u8] = b"pool";

#[constant]
pub const STAKE_SEED: &[u8] = b"stake";

#[constant]
pub const RESULT_SEED: &[u8] = b"result";

#[constant]
pub const VAULT_SEED: &[u8] = b"vault";

/// A pool's fixture list is bounded so `PoolConfig` has fixed on-chain
/// space (`InitSpace` needs a `max_len` for any `Vec`) — 16 fixtures
/// comfortably covers a real weekend/matchday gameweek.
pub const MAX_POOL_FIXTURES: usize = 16;

/// EXPANSION.md Section 4.5: "no jurisdiction gate... a single
/// STAKING_ENABLED config flag exists at the code level for operational
/// reasons only (pausing pools during an incident), defaulted to true."
/// Kept as a compile-time constant rather than a runtime-toggleable admin
/// instruction, since flipping it is meant to be a deploy-time operational
/// decision, not something exposed as an on-chain action surface.
pub const STAKING_ENABLED: bool = true;

/// create_pool's admin gate. This is the same service wallet already used
/// to deploy this program and to run every other privileged devnet action
/// in this project (confirmed to match TXLINE_SERVICE_WALLET_SECRET's
/// public key) — reusing it rather than introducing a second admin
/// identity keeps key management simple for this build.
pub const ADMIN_PUBKEY: Pubkey = pubkey!("8chhKXi72DVVZGUydubPTFom54kgfS5isEWTRyNS5eYU");
