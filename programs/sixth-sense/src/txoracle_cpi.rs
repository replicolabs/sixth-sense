//! Hand-rolled CPI client for TxOracle's `validate_stat` instruction.
//!
//! TxOracle publishes no Rust crate (confirmed by searching crates.io and
//! the txodds/tx-on-chain repo directly — only TypeScript client examples
//! exist there, nothing importable from Rust). Do NOT depend on
//! `nyx-txodds-verifier`, `nyx-txodds-oracle`, `txline`, or `txline-cpi`
//! from crates.io — those are unaffiliated third-party crates published
//! days before this was written, by accounts with no other history,
//! self-describing as CPI helpers for this exact instruction. That is a
//! textbook supply-chain trap aimed at whoever (human or agent) searches
//! for "txoracle cpi crate", and this program moves through settlement
//! logic that real money will eventually depend on (Expansion Section 4)
//! — never take a dependency like that on trust alone.
//!
//! Every type below is a field-for-field mirror of TxOracle's own IDL
//! (packages/txline/idl/txoracle.json), and the discriminator is copied
//! directly from that IDL rather than recomputed, so there's no room for
//! a hashing mismatch.

use crate::constants::TXORACLE_PROGRAM_ID;
use crate::error::SixthSenseError;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::{get_return_data, invoke};

/// IDL discriminator for `validate_stat` (sha256("global:validate_stat")[..8]).
const VALIDATE_STAT_DISCRIMINATOR: [u8; 8] = [107, 197, 232, 90, 191, 136, 105, 185];

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, InitSpace, Clone, Copy, PartialEq, Eq)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

/// Everything `validate_stat` needs besides the `daily_scores_merkle_roots`
/// account, bundled up so `settle_call`'s signature doesn't balloon.
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ValidateStatArgs {
    pub ts: i64,
    pub fixture_summary: ScoresBatchSummary,
    pub fixture_proof: Vec<ProofNode>,
    pub main_tree_proof: Vec<ProofNode>,
    pub predicate: TraderPredicate,
    pub stat_a: StatTerm,
    pub stat_b: Option<StatTerm>,
    pub op: Option<BinaryExpression>,
}

/// CPIs into TxOracle's `validate_stat`, returning the proven bool result.
///
/// Compute budget: proof verification is heavy — the CALLER's transaction
/// must prepend a `ComputeBudgetProgram.setComputeUnitLimit` instruction
/// (up to ~1.4M units per CLAUDE.md Section 9); a program can't set its
/// own compute budget from inside an instruction, that has to be done by
/// whoever builds the outer transaction.
pub fn validate_stat<'info>(
    txoracle_program: &AccountInfo<'info>,
    daily_scores_merkle_roots: &AccountInfo<'info>,
    args: ValidateStatArgs,
) -> Result<bool> {
    require_keys_eq!(
        *txoracle_program.key,
        TXORACLE_PROGRAM_ID,
        SixthSenseError::InvalidTxOracleProgram
    );

    let mut data = VALIDATE_STAT_DISCRIMINATOR.to_vec();
    args.serialize(&mut data)?;

    let instruction = Instruction {
        program_id: TXORACLE_PROGRAM_ID,
        accounts: vec![AccountMeta::new_readonly(
            *daily_scores_merkle_roots.key,
            false,
        )],
        data,
    };

    invoke(
        &instruction,
        &[
            daily_scores_merkle_roots.clone(),
            txoracle_program.clone(),
        ],
    )?;

    let (returned_program_id, return_data) =
        get_return_data().ok_or(SixthSenseError::MissingCpiReturnData)?;
    require_keys_eq!(
        returned_program_id,
        TXORACLE_PROGRAM_ID,
        SixthSenseError::InvalidTxOracleProgram
    );

    Ok(bool::try_from_slice(&return_data)?)
}
