use anchor_lang::prelude::*;

use crate::error::SixthSenseError;
use crate::pool_state::{PoolConfig, PoolStatus};

/// Permissionless — Solana has no native cron, so "locked automatically at
/// gameweek start" (EXPANSION.md Section 4.1) means anyone (typically a
/// scheduled backend job) can call this once `week_start` has passed. The
/// timestamp check is the real gate, not the caller's identity.
#[derive(Accounts)]
pub struct LockPool<'info> {
    #[account(mut)]
    pub pool_config: Account<'info, PoolConfig>,
}

pub fn handle_lock_pool(ctx: Context<LockPool>) -> Result<()> {
    let pool_config = &mut ctx.accounts.pool_config;
    require!(pool_config.status == PoolStatus::Open, SixthSenseError::PoolNotOpen);

    let now = Clock::get()?.unix_timestamp;
    require!(now >= pool_config.week_start, SixthSenseError::PoolNotYetLockable);

    pool_config.status = PoolStatus::Locked;
    Ok(())
}
