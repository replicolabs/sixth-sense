import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * Lightweight profile summary — currently just powers the home page's
 * signed-in greeting strip. Deliberately doesn't expose `points`: unlike
 * bestStreak/lifetimeWins/xp (all persisted on User via
 * check-unlocks/route.ts), session points only live in the client's
 * Zustand store today — a real lifetime points total is Phase 6
 * (leaderboard/session-summary) territory, not built yet.
 */
export async function GET(request: Request) {
  const privyId = new URL(request.url).searchParams.get("privyId");
  if (!privyId) {
    return NextResponse.json({ error: "privyId query param is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json({
    nickname: user.nickname,
    xp: user.xp,
    level: user.level,
    bestStreak: user.bestStreak,
    lifetimeWins: user.lifetimeWins,
    lifetimeMatchesPlayed: user.lifetimeMatchesPlayed,
  });
}
