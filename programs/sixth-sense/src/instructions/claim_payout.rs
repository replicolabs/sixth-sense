use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

use crate::error::SixthSenseError;
use crate::pool_constants::POOL_SEED;
use crate::pool_state::{PoolConfig, PoolStatus, StakeAccount};

/// Pull payment (EXPANSION.md Section 4.3): the program never sends funds
/// unprompted. Works identically whether the pool settled normally
/// (pari-mutuel payout, possibly zero for an unranked stake) or was
/// cancelled for missing the participant floor (full refund) — both cases
/// just read whatever `settle_pool` already wrote into `payout_amount`.
#[derive(Accounts)]
pub struct ClaimPayout<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, has_one = vault)]
    pub pool_config: Account<'info, PoolConfig>,
    #[account(
        mut,
        seeds = [crate::pool_constants::STAKE_SEED, pool_config.key().as_ref(), user.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == user.key(),
    )]
    pub stake_account: Account<'info, StakeAccount>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = pool_config.token_mint, token::authority = user)]
    pub user_token_account: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
    let status = ctx.accounts.pool_config.status;
    require!(
        status == PoolStatus::Settled || status == PoolStatus::Cancelled,
        SixthSenseError::PoolNotSettled
    );
    require!(!ctx.accounts.stake_account.claimed, SixthSenseError::AlreadyClaimed);

    let payout_amount = ctx.accounts.stake_account.payout_amount;
    let pool_id_bytes = ctx.accounts.pool_config.pool_id.to_le_bytes();
    let bump = ctx.accounts.pool_config.bump;
    let seeds: &[&[u8]] = &[POOL_SEED, &pool_id_bytes, &[bump]];
    let signer_seeds: &[&[&[u8]]] = &[seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.pool_config.to_account_info(),
            },
            signer_seeds,
        ),
        payout_amount,
    )?;

    ctx.accounts.stake_account.claimed = true;

    Ok(())
}
