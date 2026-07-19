-- CreateEnum
CREATE TYPE "TeamAssetType" AS ENUM ('club', 'country');

-- NOTE: Prisma's diff again proposed dropping ArchivedMatch_searchVector_idx
-- (it doesn't track that hand-written GIN index) — deliberately omitted,
-- see the pools migration for the full explanation.

-- CreateTable
CREATE TABLE "TeamAssetMap" (
    "id" TEXT NOT NULL,
    "txlineTeamId" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "assetType" "TeamAssetType" NOT NULL,
    "internalKitId" TEXT,
    "logoProviderTeamId" TEXT,
    "realLogoUrl" TEXT,
    "isoCountryCode" TEXT,
    "realFlagUrl" TEXT,
    "resolvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamAssetMap_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamAssetMap_txlineTeamId_key" ON "TeamAssetMap"("txlineTeamId");
