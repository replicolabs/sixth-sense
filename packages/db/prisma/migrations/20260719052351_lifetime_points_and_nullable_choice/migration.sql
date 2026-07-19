-- NOTE: Prisma's diff again proposed dropping ArchivedMatch_searchVector_idx
-- (it doesn't track that hand-written GIN index) — deliberately omitted,
-- see the pools migration for the full explanation.

-- AlterTable
ALTER TABLE "Prediction" ALTER COLUMN "choice" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lifetimePoints" INTEGER NOT NULL DEFAULT 0;
