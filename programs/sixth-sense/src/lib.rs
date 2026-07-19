pub mod constants;
pub mod error;
pub mod instructions;
pub mod pool_constants;
pub mod pool_state;
pub mod state;
pub mod txoracle_cpi;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use pool_constants::*;
pub use pool_state::*;
pub use state::*;
pub use txoracle_cpi::{BinaryExpression, ScoresBatchSummary, ProofNode, StatTerm, TraderPredicate};

declare_id!("5eLFecutwEdSSF5v3FpKbnUpNL4YVD1mmBuZnFMRbUt9");

/// CLAUDE.md Section 9: records each user's resolved call as a trustless
/// result, proven against TxLINE data via CPI into TxOracle's
/// `validate_stat`. Devnet only for this build (see constants.rs).
///
/// EXPANSION.md Section 4 extends the same program with real-money weekly
/// staking pools (create_pool/join_pool/lock_pool/record_pool_score/
/// settle_pool/claim_payout) that settle against the CallRecord PDAs this
/// base settlement already produces — no separate oracle needed.
#[program]
pub mod sixth_sense {
    use super::*;

    pub fn init_user(ctx: Context<InitUser>) -> Result<()> {
        crate::instructions::init_user::handle_init_user(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn settle_call(
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
        crate::instructions::settle_call::handle_settle_call(
            ctx,
            call_id,
            fixture_id,
            ts,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            predicate,
            stat_a,
            stat_b,
            op,
            claimed_outcome,
            awarded_points,
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub fn create_pool(
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
        crate::instructions::create_pool::handle_create_pool(
            ctx,
            pool_id,
            min_stake,
            rake_bps,
            min_participants,
            curve_k_x100,
            paid_percent_bps,
            week_start,
            week_end,
            fixture_ids,
        )
    }

    pub fn join_pool(ctx: Context<JoinPool>, amount: u64) -> Result<()> {
        crate::instructions::join_pool::handle_join_pool(ctx, amount)
    }

    pub fn lock_pool(ctx: Context<LockPool>) -> Result<()> {
        crate::instructions::lock_pool::handle_lock_pool(ctx)
    }

    pub fn record_pool_score(ctx: Context<RecordPoolScore>) -> Result<()> {
        crate::instructions::record_pool_score::handle_record_pool_score(ctx)
    }

    pub fn settle_pool(ctx: Context<SettlePool>) -> Result<()> {
        crate::instructions::settle_pool::handle_settle_pool(ctx)
    }

    pub fn claim_payout(ctx: Context<ClaimPayout>) -> Result<()> {
        crate::instructions::claim_payout::handle_claim_payout(ctx)
    }
}
