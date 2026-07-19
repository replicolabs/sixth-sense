use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::error::SixthSenseError;
use crate::pool_constants::{ADMIN_PUBKEY, MAX_POOL_FIXTURES, POOL_SEED, STAKING_ENABLED, VAULT_SEED};
use crate::pool_state::{PoolConfig, PoolStatus};

#[derive(Accounts)]
#[instruction(pool_id: u64)]
pub struct CreatePool<'info> {
    #[account(mut, address = ADMIN_PUBKEY @ SixthSenseError::NotAdmin)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + PoolConfig::INIT_SPACE,
        seeds = [POOL_SEED, &pool_id.to_le_bytes()],
        bump
    )]
    pub pool_config: Account<'info, PoolConfig>,
    pub token_mint: Account<'info, Mint>,
    /// Vault's SPL "authority" is `pool_config` itself (EXPANSION.md
    /// Section 4.4: "authority is the PoolConfig PDA itself, not a company
    /// wallet") — its own address is just a deterministic PDA for lookup,
    /// derived off `pool_config` rather than the vault's own authority.
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED, pool_config.key().as_ref()],
        bump,
        token::mint = token_mint,
        token::authority = pool_config,
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_create_pool(
    ctx: Context<CreatePool>,
    pool_id: u64,
    min_stake: u64,
    rake_bps: u16,
    min_participants: u32,
    curve_k_x100: u16,
    paid_percent_bps: u16,
    week_start: i64,
    week_end: i64,
    fixture_ids: Vec<i64>,
) -> Result<()> {
    require!(STAKING_ENABLED, SixthSenseError::StakingDisabled);
    require!(
        !fixture_ids.is_empty() && fixture_ids.len() <= MAX_POOL_FIXTURES,
        SixthSenseError::InvalidFixtureCount
    );
    require!(week_start < week_end, SixthSenseError::InvalidPoolWindow);

    let now = Clock::get()?.unix_timestamp;
    // EXPANSION.md Section 4.1: staking is only ever for matches that
    // haven't kicked off yet. `week_start` is defined as the EARLIEST
    // kickoff among `fixture_ids`, so this single check is equivalent to
    // verifying every fixture in the set is still upcoming.
    require!(now < week_start, SixthSenseError::PoolWindowAlreadyStarted);

    let pool_config = &mut ctx.accounts.pool_config;
    pool_config.admin = ctx.accounts.admin.key();
    pool_config.pool_id = pool_id;
    pool_config.token_mint = ctx.accounts.token_mint.key();
    pool_config.vault = ctx.accounts.vault.key();
    pool_config.min_stake = min_stake;
    pool_config.rake_bps = rake_bps;
    pool_config.min_participants = min_participants;
    pool_config.curve_k_x100 = curve_k_x100;
    pool_config.paid_percent_bps = paid_percent_bps;
    pool_config.week_start = week_start;
    pool_config.week_end = week_end;
    pool_config.fixture_ids = fixture_ids;
    pool_config.participant_count = 0;
    pool_config.total_staked = 0;
    pool_config.status = PoolStatus::Open;
    pool_config.bump = ctx.bumps.pool_config;

    Ok(())
}
