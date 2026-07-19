import { prisma } from "@sixth-sense/db";
import { resolveFlagCode, buildFlagUrl } from "@sixth-sense/shared";
import { NextResponse } from "next/server";

/**
 * EXPANSION.md Section 1.4: "every screen renders from TeamAssetMap,
 * never from a raw provider field directly." Checks the cache table
 * first; on a miss, resolves the team name to a flagcdn URL (flags
 * only — see packages/shared/src/flags.ts) and writes the row so the
 * lookup never has to run twice for the same TxLINE team id, and so a
 * future club-crest integration only means repopulating this one table.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const txlineTeamId = searchParams.get("txlineTeamId");
  const teamName = searchParams.get("teamName");

  if (!txlineTeamId || !teamName) {
    return NextResponse.json({ error: "txlineTeamId and teamName are required" }, { status: 400 });
  }

  const existing = await prisma.teamAssetMap.findUnique({ where: { txlineTeamId } });
  if (existing) {
    return NextResponse.json({ flagUrl: existing.realFlagUrl, logoUrl: existing.realLogoUrl });
  }

  const isoCode = resolveFlagCode(teamName);
  const flagUrl = isoCode ? buildFlagUrl(isoCode, 80) : null;

  try {
    const created = await prisma.teamAssetMap.create({
      data: {
        txlineTeamId,
        teamName,
        assetType: "country",
        isoCountryCode: isoCode,
        realFlagUrl: flagUrl,
      },
    });
    return NextResponse.json({ flagUrl: created.realFlagUrl, logoUrl: created.realLogoUrl });
  } catch {
    // Two concurrent first-lookups for the same team can race on the
    // unique constraint — whichever lost just reads what the winner wrote.
    const raced = await prisma.teamAssetMap.findUnique({ where: { txlineTeamId } });
    return NextResponse.json({ flagUrl: raced?.realFlagUrl ?? flagUrl, logoUrl: raced?.realLogoUrl ?? null });
  }
}
