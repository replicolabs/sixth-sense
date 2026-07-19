use anchor_lang::prelude::*;

#[error_code]
pub enum SixthSenseError {
    #[msg("The daily_scores_merkle_roots account does not match the derived PDA for this call's timestamp")]
    InvalidMerkleRootsAccount,
    #[msg("The txoracle_program account does not match the expected TxOracle program id")]
    InvalidTxOracleProgram,
    #[msg("TxOracle's validate_stat CPI did not return a value")]
    MissingCpiReturnData,

    #[msg("Staking pools are disabled at the code level (STAKING_ENABLED = false)")]
    StakingDisabled,
    #[msg("Only the admin wallet may call this instruction")]
    NotAdmin,
    #[msg("week_start must be strictly before week_end")]
    InvalidPoolWindow,
    #[msg("A pool needs at least one fixture, and no more than MAX_POOL_FIXTURES")]
    InvalidFixtureCount,
    #[msg("week_start has already passed — a pool can't be opened for a gameweek that's already started")]
    PoolWindowAlreadyStarted,
    #[msg("This pool is not open for new stakes")]
    PoolNotOpen,
    #[msg("The gameweek's first match has already kicked off — staking has closed")]
    GameweekAlreadyStarted,
    #[msg("Stake amount is below this pool's configured minimum")]
    StakeBelowMinimum,
    #[msg("This pool has not reached its lock time yet")]
    PoolNotYetLockable,
    #[msg("This pool is not locked")]
    PoolNotLocked,
    #[msg("This CallRecord does not belong to the user being scored")]
    CallRecordOwnerMismatch,
    #[msg("This CallRecord's fixture is not part of this pool's gameweek")]
    FixtureNotInPool,
    #[msg("This user's pool score has already been recorded")]
    AlreadyScored,
    #[msg("The gameweek window has not ended yet — matches may still be in progress")]
    GameweekNotYetEnded,
    #[msg("Every participant's pool score must be recorded before settling")]
    IncompleteScoring,
    #[msg("A StakeAccount passed into settle_pool does not belong to this pool")]
    StakeAccountPoolMismatch,
    #[msg("This pool has already been settled or cancelled")]
    PoolAlreadySettled,
    #[msg("This pool has not been settled yet")]
    PoolNotSettled,
    #[msg("This payout has already been claimed")]
    AlreadyClaimed,
}
