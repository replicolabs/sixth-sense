-- CreateTable
CREATE TABLE "ArchivedMatch" (
    "id" TEXT NOT NULL,
    "fixtureId" TEXT NOT NULL,
    "competition" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "season" TEXT NOT NULL,
    "participant1" TEXT NOT NULL,
    "participant2" TEXT NOT NULL,
    "participant1Score" INTEGER NOT NULL,
    "participant2Score" INTEGER NOT NULL,
    "kickoffDate" TIMESTAMP(3) NOT NULL,
    "eventStreamRef" TEXT NOT NULL,
    "proofsRef" TEXT,
    "tags" TEXT[],
    "archivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "searchVector" tsvector,

    CONSTRAINT "ArchivedMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArchivedMatch_fixtureId_key" ON "ArchivedMatch"("fixtureId");

-- CreateIndex
CREATE INDEX "ArchivedMatch_competition_idx" ON "ArchivedMatch"("competition");

-- CreateIndex
CREATE INDEX "ArchivedMatch_participant1_idx" ON "ArchivedMatch"("participant1");

-- CreateIndex
CREATE INDEX "ArchivedMatch_participant2_idx" ON "ArchivedMatch"("participant2");

-- Full-text search (EXPANSION.md Section 2.4: "Postgres full text search
-- is enough at this scale"). A GENERATED column was the first attempt,
-- but Postgres rejects it: array_to_string (needed to fold the tags[]
-- array into the vector) isn't marked IMMUTABLE, and generated columns
-- require every function in the expression to be. A trigger has no such
-- restriction, which is why this was the standard approach before
-- generated columns existed at all.
CREATE OR REPLACE FUNCTION archived_match_search_vector_trigger() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('english', coalesce(NEW."participant1", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."participant2", '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW."competition", '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(coalesce(NEW."tags", ARRAY[]::text[]), ' ')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER archived_match_search_vector_update
  BEFORE INSERT OR UPDATE ON "ArchivedMatch"
  FOR EACH ROW EXECUTE FUNCTION archived_match_search_vector_trigger();

CREATE INDEX "ArchivedMatch_searchVector_idx" ON "ArchivedMatch" USING GIN ("searchVector");
