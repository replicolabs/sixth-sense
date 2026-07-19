use anchor_lang::prelude::*;

use crate::error::SixthSenseError;
use crate::pool_state::{PoolConfig, PoolStatus, StakeAccount};
use crate::state::CallRecord;

/// Permissionless, one call per participant. `ctx.remaining_accounts` must
/// be exactly that one user's `CallRecord` PDAs (already trustlessly
/// settled against TxOracle proofs by `settle_call` — see CLAUDE.md
/// Section 9) — this instruction only sums `awarded_points` across the
/// ones whose `fixture_id` falls inside this pool's gameweek. Splitting
/// scoring into one instruction per user (rather than EXPANSION.md
/// Section 4.4's single `settle_pool(rankings_proof)` reading every
/// participant's call records itself) keeps each instruction's compute
/// and account-list size bounded regardless of how many people join a
/// pool — `settle_pool` then only has to rank already-computed totals.
#[derive(Accounts)]
pub struct RecordPoolScore<'info> {
    pub pool_config: Account<'info, PoolConfig>,
    #[account(
        mut,
        constraint = stake_account.pool == pool_config.key() @ SixthSenseError::StakeAccountPoolMismatch,
    )]
    pub stake_account: Account<'info, StakeAccount>,
}

pub fn handle_record_pool_score(ctx: Context<RecordPoolScore>) -> Result<()> {
    let pool_config = &ctx.accounts.pool_config;
    require!(pool_config.status == PoolStatus::Locked, SixthSenseError::PoolNotLocked);

    let stake_account = &mut ctx.accounts.stake_account;
    require!(!stake_account.scored, SixthSenseError::AlreadyScored);

    let mut total_points: u64 = 0;
    for account_info in ctx.remaining_accounts.iter() {
        let call_record: Account<CallRecord> = Account::try_from(account_info)?;
        require_keys_eq!(
            call_record.owner,
            stake_account.owner,
            SixthSenseError::CallRecordOwnerMismatch
        );
        require!(
            pool_config.fixture_ids.contains(&call_record.fixture_id),
            SixthSenseError::FixtureNotInPool
        );
        total_points = total_points.checked_add(call_record.awarded_points).unwrap();
    }

    stake_account.pool_points = total_points;
    stake_account.scored = true;

    Ok(())
}
