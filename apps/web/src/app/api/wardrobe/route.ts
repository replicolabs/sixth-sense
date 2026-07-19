import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * EXPANSION.md Section 1.3: everything the wardrobe screen needs to show
 * locked/unlocked kits and progress toward the next one — the user's
 * avatar (nationality + currently equipped kit), which club-inspired kits
 * are already unlocked, and the lifetime stats each kit's unlock
 * condition is measured against.
 */
export async function GET(request: Request) {
  const privyId = new URL(request.url).searchParams.get("privyId");
  if (!privyId) {
    return NextResponse.json({ error: "privyId is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { privyId },
    include: { avatar: true, kitUnlocks: true },
  });
  if (!user) {
    return NextResponse.json({ error: "user not found — sync login first" }, { status: 404 });
  }

  return NextResponse.json({
    nationalityCode: user.avatar?.nationalityCode ?? null,
    equippedKitId: user.avatar?.equippedKitId ?? null,
    unlockedKitIds: user.kitUnlocks.map((k) => k.kitId),
    stats: {
      sessionStreak: user.bestStreak,
      lifetimeWins: user.lifetimeWins,
      matchesPlayed: user.lifetimeMatchesPlayed,
      xpLevel: user.level,
    },
  });
}
