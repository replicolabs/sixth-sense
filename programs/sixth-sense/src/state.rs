use anchor_lang::prelude::*;

use crate::txoracle_cpi::{BinaryExpression, Comparison};

/// seeds = [USER_SEED, user_pubkey] (CLAUDE.md Section 9).
#[account]
#[derive(InitSpace)]
pub struct UserRecord {
    pub owner: Pubkey,
    pub points: u64,
    pub wins: u32,
    pub losses: u32,
    pub current_streak: u32,
    pub best_streak: u32,
    pub bump: u8,
}

/// seeds = [CALL_SEED, user_pubkey, call_id] (CLAUDE.md Section 9).
/// Stores enough of the predicate to audit "what was checked" without
/// keeping the (large, only transiently useful) Merkle proof data on
/// chain permanently.
#[account]
#[derive(InitSpace)]
pub struct CallRecord {
    pub owner: Pubkey,
    pub call_id: u64,
    pub fixture_id: i64,
    pub stat_key_a: u32,
    pub stat_key_b: Option<u32>,
    pub op: Option<BinaryExpression>,
    pub comparison: Comparison,
    pub threshold: i32,
    pub claimed_outcome: bool,
    pub proven_outcome: bool,
    pub awarded_points: u64,
    pub ts: i64,
    pub bump: u8,
}
