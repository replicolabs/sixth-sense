use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::SixthSenseError;
use crate::pool_constants::{STAKE_SEED, STAKING_ENABLED};
use crate::pool_state::{PoolConfig, PoolStatus, StakeAccount};

#[derive(Accounts)]
pub struct JoinPool<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub pool_config: Account<'info, PoolConfig>,
    /// `init`-only, never `init_if_needed` — a second `join_pool` from the
    /// same wallet on the same pool fails because this PDA already exists,
    /// which is EXPANSION.md Section 4.3's "one wallet, one entry per
    /// pool" enforced as simply as possible.
    #[account(
        init,
        payer = user,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [STAKE_SEED, pool_config.key().as_ref(), user.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut, token::mint = pool_config.token_mint, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handle_join_pool(ctx: Context<JoinPool>, amount: u64) -> Result<()> {
    require!(STAKING_ENABLED, SixthSenseError::StakingDisabled);

    let pool_config = &ctx.accounts.pool_config;
    require!(pool_config.status == PoolStatus::Open, SixthSenseError::PoolNotOpen);

    let now = Clock::get()?.unix_timestamp;
    // Defense in depth alongside `lock_pool` — join_pool independently
    // re-checks the same "nothing has kicked off yet" rule rather than
    // trusting status alone to have been flipped in time.
    require!(now < pool_config.week_start, SixthSenseError::GameweekAlreadyStarted);
    require!(amount >= pool_config.min_stake, SixthSenseError::StakeBelowMinimum);

    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;

    let stake_account = &mut ctx.accounts.stake_account;
    stake_account.pool = ctx.accounts.pool_config.key();
    stake_account.owner = ctx.accounts.user.key();
    stake_account.amount_staked = amount;
    stake_account.joined_at = now;
    stake_account.pool_points = 0;
    stake_account.scored = false;
    stake_account.rank = 0;
    stake_account.payout_amount = 0;
    stake_account.claimed = false;
    stake_account.bump = ctx.bumps.stake_account;

    let pool_config = &mut ctx.accounts.pool_config;
    pool_config.participant_count = pool_config.participant_count.checked_add(1).unwrap();
    pool_config.total_staked = pool_config.total_staked.checked_add(amount).unwrap();

    Ok(())
}
