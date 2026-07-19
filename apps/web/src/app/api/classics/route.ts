import { Prisma, prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * EXPANSION.md Section 2.4: "a self-built, searchable practice-match
 * library... Postgres full text search is enough at this scale." Query
 * param `q` free-texts against the `searchVector` trigger (see the
 * ArchivedMatch migration) using `websearch_to_tsquery`, which is the
 * variant meant for a plain search box: it tolerates ordinary text,
 * quoted phrases, and "-word" exclusions without throwing on the
 * operator syntax `to_tsquery` requires. Falls back to newest-first
 * browsing when `q` is empty. Optional `tag` narrows to one editorial tag.
 */
export interface ClassicsRow {
  id: string;
  fixtureId: string;
  competition: string;
  season: string;
  participant1: string;
  participant2: string;
  participant1Score: number;
  participant2Score: number;
  kickoffDate: Date;
  tags: string[];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const tag = searchParams.get("tag")?.trim() ?? "";
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 50);

  const tagFilter = tag ? Prisma.sql`AND ${tag} = ANY("tags")` : Prisma.empty;

  const rows = q
    ? await prisma.$queryRaw<ClassicsRow[]>`
        SELECT "id", "fixtureId", "competition", "season", "participant1", "participant2",
               "participant1Score", "participant2Score", "kickoffDate", "tags"
        FROM "ArchivedMatch"
        WHERE "searchVector" @@ websearch_to_tsquery('english', ${q})
        ${tagFilter}
        ORDER BY ts_rank("searchVector", websearch_to_tsquery('english', ${q})) DESC,
                 "kickoffDate" DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<ClassicsRow[]>`
        SELECT "id", "fixtureId", "competition", "season", "participant1", "participant2",
               "participant1Score", "participant2Score", "kickoffDate", "tags"
        FROM "ArchivedMatch"
        WHERE true
        ${tagFilter}
        ORDER BY "kickoffDate" DESC
        LIMIT ${limit}
      `;

  return NextResponse.json({ matches: rows });
}
