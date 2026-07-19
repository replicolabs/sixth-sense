use anchor_lang::prelude::*;

use crate::pool_constants::MAX_POOL_FIXTURES;

/// EXPANSION.md Section 4.1/4.4.
#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum PoolStatus {
    Open,
    Locked,
    Settled,
    Cancelled,
}

/// seeds = [POOL_SEED, pool_id.to_le_bytes()].
///
/// `week_start` doubles as the "no live/finished matches" gate for both
/// `create_pool` and `join_pool` (EXPANSION.md Section 4.1): it MUST be set
/// to the EARLIEST kickoff among `fixture_ids`, so checking
/// `now < week_start` is sufficient to guarantee none of the gameweek's
/// matches have started yet, without the program needing a live oracle
/// lookup per fixture.
#[account]
#[derive(InitSpace)]
pub struct PoolConfig {
    pub admin: Pubkey,
    pub pool_id: u64,
    pub token_mint: Pubkey,
    pub vault: Pubkey,
    pub min_stake: u64,
    pub rake_bps: u16,
    pub min_participants: u32,
    /// Payout curve exponent k, fixed-point as `k * 100` (e.g. 150 = 1.5).
    pub curve_k_x100: u16,
    /// Fraction of participants who get paid, in basis points (e.g. 2000 = 20%).
    pub paid_percent_bps: u16,
    pub week_start: i64,
    pub week_end: i64,
    #[max_len(MAX_POOL_FIXTURES)]
    pub fixture_ids: Vec<i64>,
    pub participant_count: u32,
    pub total_staked: u64,
    pub status: PoolStatus,
    pub bump: u8,
}

/// seeds = [STAKE_SEED, pool.key(), user_pubkey]. `init`-only (never
/// `init_if_needed`) so a second `join_pool` call from the same wallet on
/// the same pool fails outright — the simplest possible enforcement of
/// EXPANSION.md Section 4.3's "one wallet, one entry per pool."
#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub pool: Pubkey,
    pub owner: Pubkey,
    pub amount_staked: u64,
    pub joined_at: i64,
    /// Written once by `record_pool_score`, guarded by `scored`.
    pub pool_points: u64,
    pub scored: bool,
    /// 1-indexed; 0 means unranked (pool cancelled, or not yet settled).
    pub rank: u32,
    /// Either a pari-mutuel payout share, or a full refund if the pool
    /// was cancelled for missing the `min_participants` floor.
    pub payout_amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

/// seeds = [RESULT_SEED, pool.key()]. One aggregate record written by
/// `settle_pool` — per-participant rank/payout live on each `StakeAccount`
/// instead of a rankings[] vec here, since a single account can't hold an
/// unbounded list for an arbitrarily large pool.
#[account]
#[derive(InitSpace)]
pub struct PoolResult {
    pub pool: Pubkey,
    pub settled_at: i64,
    pub total_pool: u64,
    pub rake_amount: u64,
    pub distributable_pot: u64,
    pub paid_count: u32,
    /// True if the pool missed `min_participants` and every stake was
    /// refunded in full instead of ranked.
    pub cancelled: bool,
    pub bump: u8,
}
