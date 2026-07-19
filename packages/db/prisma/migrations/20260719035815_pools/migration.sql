-- CreateEnum
CREATE TYPE "PoolStatus" AS ENUM ('open', 'locked', 'settled', 'cancelled');

-- NOTE: Prisma's migration diff proposed `DROP INDEX "ArchivedMatch_searchVector_idx"`
-- here — it doesn't track that GIN index since it was added by hand in the
-- ArchivedMatch migration (Unsupported("tsvector") fields have no
-- declarative @@index support), so it thinks the schema no longer wants
-- it. Deliberately dropped from this migration: that index backs the
-- Classics shelf's full-text search (Section 2.4) and must not be removed.

-- CreateTable
CREATE TABLE "Pool" (
    "id" TEXT NOT NULL,
    "poolIdOnChain" TEXT NOT NULL,
    "poolConfigAddress" TEXT NOT NULL,
    "vaultAddress" TEXT NOT NULL,
    "tokenMint" TEXT NOT NULL,
    "gameweekLabel" TEXT NOT NULL,
    "minStake" BIGINT NOT NULL,
    "rakeBps" INTEGER NOT NULL,
    "minParticipants" INTEGER NOT NULL,
    "curveKX100" INTEGER NOT NULL,
    "paidPercentBps" INTEGER NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "weekEnd" TIMESTAMP(3) NOT NULL,
    "fixtureIds" TEXT[],
    "status" "PoolStatus" NOT NULL DEFAULT 'open',
    "participantCount" INTEGER NOT NULL DEFAULT 0,
    "totalStaked" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StakeEntry" (
    "id" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stakeAccountAddress" TEXT NOT NULL,
    "amountStaked" BIGINT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "poolPoints" BIGINT NOT NULL DEFAULT 0,
    "scored" BOOLEAN NOT NULL DEFAULT false,
    "rank" INTEGER,
    "payoutAmount" BIGINT,
    "claimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "StakeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Pool_poolIdOnChain_key" ON "Pool"("poolIdOnChain");

-- CreateIndex
CREATE UNIQUE INDEX "Pool_poolConfigAddress_key" ON "Pool"("poolConfigAddress");

-- CreateIndex
CREATE INDEX "Pool_status_idx" ON "Pool"("status");

-- CreateIndex
CREATE UNIQUE INDEX "StakeEntry_stakeAccountAddress_key" ON "StakeEntry"("stakeAccountAddress");

-- CreateIndex
CREATE INDEX "StakeEntry_poolId_idx" ON "StakeEntry"("poolId");

-- CreateIndex
CREATE INDEX "StakeEntry_userId_idx" ON "StakeEntry"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StakeEntry_poolId_userId_key" ON "StakeEntry"("poolId", "userId");

-- AddForeignKey
ALTER TABLE "StakeEntry" ADD CONSTRAINT "StakeEntry_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "Pool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StakeEntry" ADD CONSTRAINT "StakeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
