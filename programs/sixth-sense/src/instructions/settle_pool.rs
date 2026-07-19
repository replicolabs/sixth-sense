use anchor_lang::prelude::*;

use crate::error::SixthSenseError;
use crate::pool_constants::RESULT_SEED;
use crate::pool_state::{PoolConfig, PoolResult, PoolStatus, StakeAccount};

/// Permissionless (any signer just covers `pool_result`'s small rent).
/// `ctx.remaining_accounts` must be every `StakeAccount` belonging to this
/// pool, one per participant, each already scored via
/// `record_pool_score` — see that instruction's docstring for why ranking
/// happens here on already-computed totals instead of re-reading every
/// `CallRecord` in one shot.
#[derive(Accounts)]
pub struct SettlePool<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(mut)]
    pub pool_config: Account<'info, PoolConfig>,
    #[account(
        init,
        payer = payer,
        space = 8 + PoolResult::INIT_SPACE,
        seeds = [RESULT_SEED, pool_config.key().as_ref()],
        bump
    )]
    pub pool_result: Account<'info, PoolResult>,
    pub system_program: Program<'info, System>,
}

struct Entry<'info> {
    account: Account<'info, StakeAccount>,
    points: u64,
}

pub fn handle_settle_pool(ctx: Context<SettlePool>) -> Result<()> {
    let pool_key = ctx.accounts.pool_config.key();
    let now = Clock::get()?.unix_timestamp;

    require!(ctx.accounts.pool_config.status == PoolStatus::Locked, SixthSenseError::PoolNotLocked);
    require!(now >= ctx.accounts.pool_config.week_end, SixthSenseError::GameweekNotYetEnded);

    let participant_count = ctx.accounts.pool_config.participant_count as usize;
    require!(
        ctx.remaining_accounts.len() == participant_count,
        SixthSenseError::IncompleteScoring
    );

    let mut entries: Vec<Entry> = Vec::with_capacity(participant_count);
    for account_info in ctx.remaining_accounts.iter() {
        let stake: Account<StakeAccount> = Account::try_from(account_info)?;
        require_keys_eq!(stake.pool, pool_key, SixthSenseError::StakeAccountPoolMismatch);
        require!(stake.scored, SixthSenseError::IncompleteScoring);
        let points = stake.pool_points;
        entries.push(Entry { account: stake, points });
    }

    let total_pool = ctx.accounts.pool_config.total_staked;
    let min_participants = ctx.accounts.pool_config.min_participants as usize;

    // EXPANSION.md Section 4.3: under the participant floor, refund
    // everyone in full and take no rake, rather than run a lopsided pool.
    if entries.len() < min_participants {
        for entry in entries.iter_mut() {
            entry.account.rank = 0;
            entry.account.payout_amount = entry.account.amount_staked;
            entry.account.exit(ctx.program_id)?;
        }

        let pool_result = &mut ctx.accounts.pool_result;
        pool_result.pool = pool_key;
        pool_result.settled_at = now;
        pool_result.total_pool = total_pool;
        pool_result.rake_amount = 0;
        pool_result.distributable_pot = total_pool;
        pool_result.paid_count = 0;
        pool_result.cancelled = true;
        pool_result.bump = ctx.bumps.pool_result;

        ctx.accounts.pool_config.status = PoolStatus::Cancelled;
        return Ok(());
    }

    // Sort by pool-scoped points, highest first.
    let mut order: Vec<usize> = (0..entries.len()).collect();
    order.sort_by(|&a, &b| entries[b].points.cmp(&entries[a].points));

    let rake_bps = ctx.accounts.pool_config.rake_bps as u128;
    let rake_amount = ((total_pool as u128 * rake_bps) / 10_000) as u64;
    let distributable_pot = total_pool.checked_sub(rake_amount).unwrap();

    let count = entries.len() as u64;
    let paid_percent_bps = ctx.accounts.pool_config.paid_percent_bps as u64;
    // Ceiling division without relying on the newer u64::div_ceil stdlib
    // method, which may postdate the SBF toolchain's pinned rustc.
    let paid_count = std::cmp::max(1, (count * paid_percent_bps + 9_999) / 10_000) as u32;
    let k = ctx.accounts.pool_config.curve_k_x100 as f64 / 100.0;

    let mut ranks = vec![0u32; entries.len()];
    let mut weights = vec![0.0f64; entries.len()];

    // Standard competition ranking (1,2,2,4): a tied group shares the rank
    // of its first sorted position. EXPANSION.md Section 4.2's per-rank
    // weight formula is evaluated at every ABSTRACT slot the tied group
    // occupies (including any slot past `paid_count`, which contributes
    // zero), then averaged across the group — this is "share the payout
    // for their shared rank band equally" (Section 4.2) rather than paying
    // every tied member the full weight of the band's best slot.
    let mut i = 0;
    while i < order.len() {
        let mut j = i;
        while j + 1 < order.len() && entries[order[j + 1]].points == entries[order[i]].points {
            j += 1;
        }
        let rank = (i + 1) as u32;
        let group_size = (j - i + 1) as f64;
        let mut group_weight_sum = 0.0f64;
        for position in (i + 1)..=(j + 1) {
            if (position as u32) <= paid_count {
                let base = (paid_count - position as u32 + 1) as f64;
                group_weight_sum += base.powf(k);
            }
        }
        let shared_weight = group_weight_sum / group_size;
        for &slot in &order[i..=j] {
            ranks[slot] = rank;
            weights[slot] = shared_weight;
        }
        i = j + 1;
    }

    let total_weight: f64 = weights.iter().sum();
    let mut payouts = vec![0u64; entries.len()];
    let mut distributed: u64 = 0;
    if total_weight > 0.0 {
        for (idx, w) in weights.iter().enumerate() {
            let payout = ((distributable_pot as f64) * w / total_weight).floor() as u64;
            payouts[idx] = payout;
            distributed += payout;
        }
    }
    // Flooring can leave a handful of atomic units undistributed — hand
    // the dust to the top-ranked entry so sum(payouts) == distributable_pot
    // exactly (EXPANSION.md Section 4.2's stated invariant).
    if let Some(&top) = order.first() {
        payouts[top] += distributable_pot.saturating_sub(distributed);
    }

    for (idx, entry) in entries.iter_mut().enumerate() {
        entry.account.rank = ranks[idx];
        entry.account.payout_amount = payouts[idx];
        entry.account.exit(ctx.program_id)?;
    }

    let pool_result = &mut ctx.accounts.pool_result;
    pool_result.pool = pool_key;
    pool_result.settled_at = now;
    pool_result.total_pool = total_pool;
    pool_result.rake_amount = rake_amount;
    pool_result.distributable_pot = distributable_pot;
    pool_result.paid_count = paid_count;
    pool_result.cancelled = false;
    pool_result.bump = ctx.bumps.pool_result;

    ctx.accounts.pool_config.status = PoolStatus::Settled;

    Ok(())
}
