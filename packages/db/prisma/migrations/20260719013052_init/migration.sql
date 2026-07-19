-- CreateEnum
CREATE TYPE "MatchMode" AS ENUM ('live', 'replay');

-- CreateEnum
CREATE TYPE "CardChoice" AS ENUM ('yes', 'no');

-- CreateEnum
CREATE TYPE "CardOutcome" AS ENUM ('win', 'loss', 'void');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('pending', 'proven', 'failed');

-- CreateEnum
CREATE TYPE "UnlockSource" AS ENUM ('streak', 'xp', 'matchesPlayed', 'event');

-- CreateEnum
CREATE TYPE "Presentation" AS ENUM ('male', 'female', 'neutral');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "privyId" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Avatar" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skinTone" TEXT NOT NULL,
    "hairStyle" TEXT NOT NULL,
    "hairColor" TEXT NOT NULL,
    "facialHair" TEXT NOT NULL,
    "presentation" "Presentation" NOT NULL,
    "nationalityCode" TEXT NOT NULL,
    "equippedKitId" TEXT,
    "equippedAccessoryIds" TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Avatar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "KitUnlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "unlockedVia" "UnlockSource" NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KitUnlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "mode" "MatchMode" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "pointsTotal" INTEGER NOT NULL DEFAULT 0,
    "bestStreak" INTEGER NOT NULL DEFAULT 0,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "callsWon" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prediction" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "choice" "CardChoice" NOT NULL,
    "windowStartSeq" INTEGER NOT NULL,
    "windowEndTs" BIGINT NOT NULL,
    "resolvedSeq" INTEGER,
    "outcome" "CardOutcome",
    "basePoints" INTEGER NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL,
    "awardedPoints" INTEGER NOT NULL,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'pending',
    "settlementSig" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prediction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_privyId_key" ON "User"("privyId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Avatar_userId_key" ON "Avatar"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "KitUnlock_userId_kitId_key" ON "KitUnlock"("userId", "kitId");

-- CreateIndex
CREATE INDEX "MatchSession_userId_idx" ON "MatchSession"("userId");

-- CreateIndex
CREATE INDEX "MatchSession_fixtureId_idx" ON "MatchSession"("fixtureId");

-- CreateIndex
CREATE INDEX "Prediction_sessionId_idx" ON "Prediction"("sessionId");

-- CreateIndex
CREATE INDEX "Prediction_userId_idx" ON "Prediction"("userId");

-- AddForeignKey
ALTER TABLE "Avatar" ADD CONSTRAINT "Avatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitUnlock" ADD CONSTRAINT "KitUnlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchSession" ADD CONSTRAINT "MatchSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prediction" ADD CONSTRAINT "Prediction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
