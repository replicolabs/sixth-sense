use anchor_lang::prelude::*;

use crate::constants::{CALL_SEED, DAILY_SCORES_ROOTS_SEED, TXORACLE_PROGRAM_ID, USER_SEED};
use crate::error::SixthSenseError;
use crate::state::{CallRecord, UserRecord};
use crate::txoracle_cpi::{
    self, BinaryExpression, ScoresBatchSummary, ProofNode, StatTerm, TraderPredicate,
    ValidateStatArgs,
};

#[derive(Accounts)]
#[instruction(call_id: u64)]
pub struct SettleCall<'info> {
    /// The authorized backend settler (CLAUDE.md Section 8) — not
    /// necessarily the player; it pays for CallRecord's rent.
    #[account(mut)]
    pub settler: Signer<'info>,
    #[account(
        mut,
        seeds = [USER_SEED, user_record.owner.as_ref()],
        bump = user_record.bump,
    )]
    pub user_record: Account<'info, UserRecord>,
    /// `init` alone is enough to prevent double-settling the same
    /// call_id — a second attempt fails with Anchor's own
    /// account-already-in-use error.
    #[account(
        init,
        payer = settler,
        space = 8 + CallRecord::INIT_SPACE,
        seeds = [CALL_SEED, user_record.owner.as_ref(), &call_id.to_le_bytes()],
        bump
    )]
    pub call_record: Account<'info, CallRecord>,
    /// CHECK: verified against TXORACLE_PROGRAM_ID inside the CPI helper before use.
    pub txoracle_program: UncheckedAccount<'info>,
    /// CHECK: PDA derivation verified against DAILY_SCORES_ROOTS_SEED + epoch_day(ts) below.
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_settle_call(
    ctx: Context<SettleCall>,
    call_id: u64,
    fixture_id: i64,
    ts: i64,
    fixture_summary: ScoresBatchSummary,
    fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
    predicate: TraderPredicate,
    stat_a: StatTerm,
    stat_b: Option<StatTerm>,
    op: Option<BinaryExpression>,
    claimed_outcome: bool,
    awarded_points: u64,
) -> Result<()> {
    // TxOracle would reject a mismatched root anyway, but failing here
    // first gives a clearer error than a generic CPI-layer failure.
    let epoch_day = (ts / 86_400_000) as u16;
    let (expected_roots_pda, _) = Pubkey::find_program_address(
        &[DAILY_SCORES_ROOTS_SEED, &epoch_day.to_le_bytes()],
        &TXORACLE_PROGRAM_ID,
    );
    require_keys_eq!(
        ctx.accounts.daily_scores_merkle_roots.key(),
        expected_roots_pda,
        SixthSenseError::InvalidMerkleRootsAccount
    );

    let stat_key_a = stat_a.stat_to_prove.key;
    let stat_key_b = stat_b.as_ref().map(|s| s.stat_to_prove.key);
    let comparison = predicate.comparison;
    let threshold = predicate.threshold;

    let proven_outcome = txoracle_cpi::validate_stat(
        &ctx.accounts.txoracle_program.to_account_info(),
        &ctx.accounts.daily_scores_merkle_roots.to_account_info(),
        ValidateStatArgs {
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            predicate,
            stat_a,
            stat_b,
            op,
        },
    )?;

    let call_record = &mut ctx.accounts.call_record;
    call_record.owner = ctx.accounts.user_record.owner;
    call_record.call_id = call_id;
    call_record.fixture_id = fixture_id;
    call_record.stat_key_a = stat_key_a;
    call_record.stat_key_b = stat_key_b;
    call_record.op = op;
    call_record.comparison = comparison;
    call_record.threshold = threshold;
    call_record.claimed_outcome = claimed_outcome;
    call_record.proven_outcome = proven_outcome;
    call_record.ts = ts;
    call_record.bump = ctx.bumps.call_record;

    let user_record = &mut ctx.accounts.user_record;
    if claimed_outcome == proven_outcome {
        user_record.wins += 1;
        user_record.points += awarded_points;
        user_record.current_streak += 1;
        if user_record.current_streak > user_record.best_streak {
            user_record.best_streak = user_record.current_streak;
        }
        call_record.awarded_points = awarded_points;
    } else {
        user_record.losses += 1;
        user_record.current_streak = 0;
        call_record.awarded_points = 0;
    }

    Ok(())
}
