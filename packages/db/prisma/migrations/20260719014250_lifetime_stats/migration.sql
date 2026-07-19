-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lifetimeMatchesPlayed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lifetimeWins" INTEGER NOT NULL DEFAULT 0;
