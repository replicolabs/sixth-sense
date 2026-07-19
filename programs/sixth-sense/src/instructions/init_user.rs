use anchor_lang::prelude::*;

use crate::constants::USER_SEED;
use crate::state::UserRecord;

/// `payer` and `owner` are deliberately separate — CLAUDE.md Section 8's
/// invisible settlement model has the SERVICE wallet settle a player's
/// calls server-side, with no live signature from the player's own
/// embedded wallet in the hot path. A UserRecord seeded off `user: Signer`
/// (the original shape) could only ever be created by the owner signing
/// themselves, which blocks exactly that flow the first time a brand new
/// player needs one. `owner` doesn't sign — its pubkey is only used to
/// derive and tag the PDA — while `payer` covers rent and can be the
/// service wallet, the player's own wallet, or anyone else.
#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: never read as executable or deserialized — only its pubkey
    /// is used, to derive and stamp the PDA it owns.
    pub owner: UncheckedAccount<'info>,
    #[account(
        init,
        payer = payer,
        space = 8 + UserRecord::INIT_SPACE,
        seeds = [USER_SEED, owner.key().as_ref()],
        bump
    )]
    pub user_record: Account<'info, UserRecord>,
    pub system_program: Program<'info, System>,
}

pub fn handle_init_user(ctx: Context<InitUser>) -> Result<()> {
    let user_record = &mut ctx.accounts.user_record;
    user_record.owner = ctx.accounts.owner.key();
    user_record.points = 0;
    user_record.wins = 0;
    user_record.losses = 0;
    user_record.current_streak = 0;
    user_record.best_streak = 0;
    user_record.bump = ctx.bumps.user_record;
    Ok(())
}
