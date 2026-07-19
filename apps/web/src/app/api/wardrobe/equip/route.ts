import { prisma } from "@sixth-sense/db";
import { CLUB_KIT_CATALOG, nationalKitId, type UnlockConditionType } from "@sixth-sense/shared";
import { NextResponse } from "next/server";

const STAT_FOR: Record<UnlockConditionType, (u: { bestStreak: number; lifetimeWins: number; lifetimeMatchesPlayed: number; level: number }) => number> = {
  sessionStreak: (u) => u.bestStreak,
  lifetimeWins: (u) => u.lifetimeWins,
  matchesPlayed: (u) => u.lifetimeMatchesPlayed,
  xpLevel: (u) => u.level,
};

/**
 * EXPANSION.md Section 1.3's "tap to equip." Re-validates server-side that
 * the requested kit is actually unlocked (or is the always-available
 * national kit) rather than trusting the client — a locked kit's colors
 * are only ever a few hex codes away in the client bundle, so this can't
 * be a client-only check.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { privyId, kitId } = body as { privyId?: string; kitId?: string };

  if (!privyId || !kitId) {
    return NextResponse.json({ error: "privyId and kitId are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { privyId },
    include: { avatar: true, kitUnlocks: true },
  });
  if (!user || !user.avatar) {
    return NextResponse.json({ error: "user or avatar not found" }, { status: 404 });
  }

  const isNationalKit = kitId === nationalKitId(user.avatar.nationalityCode);
  const isUnlockedClubKit = user.kitUnlocks.some((k) => k.kitId === kitId);

  if (!isNationalKit && !isUnlockedClubKit) {
    // Defense in depth: even if the id somehow slipped through unlocked,
    // confirm the underlying condition is genuinely met right now.
    const kit = CLUB_KIT_CATALOG.find((k) => k.id === kitId);
    const meetsCondition = kit && STAT_FOR[kit.unlock.type](user) >= kit.unlock.threshold;
    if (!meetsCondition) {
      return NextResponse.json({ error: "kit is not unlocked" }, { status: 403 });
    }
  }

  const avatar = await prisma.avatar.update({
    where: { userId: user.id },
    data: { equippedKitId: kitId },
  });

  return NextResponse.json({ equippedKitId: avatar.equippedKitId });
}
