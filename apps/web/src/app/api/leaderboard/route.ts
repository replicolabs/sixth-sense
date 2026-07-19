import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * CLAUDE.md Section 11.5: "Global and Friends tabs. Friends via a simple
 * share code (no heavy social graph in v1)." A user's own privyId IS
 * their share code — there's no server-side friend graph, just an
 * optional `codes` filter the client supplies (a locally-stored list the
 * user built by pasting in codes people shared with them).
 *
 * ?scope=global (default) — top 50 by lifetimePoints.
 * ?scope=friends&codes=a,b,c — only those privyIds, still ranked globally
 * (rank reflects true global standing, not just position within the
 * filtered set), plus the viewer's own row via ?privyId= even if it
 * wouldn't otherwise make the cut.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "friends" ? "friends" : "global";
  const viewerPrivyId = searchParams.get("privyId");
  const codes = (searchParams.get("codes") ?? "")
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

  if (scope === "friends" && codes.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  // Global rank is computed over the WHOLE table (not just the filtered
  // set), so a friends-tab row's rank always reflects true standing.
  const allRanked = await prisma.user.findMany({
    where: { lifetimePoints: { gt: 0 } },
    orderBy: [{ lifetimePoints: "desc" }, { bestStreak: "desc" }],
    select: { privyId: true, nickname: true, lifetimePoints: true, bestStreak: true },
  });

  const withRank = allRanked.map((u, i) => ({ ...u, rank: i + 1 }));

  let rows = withRank;
  if (scope === "friends") {
    const codeSet = new Set(codes);
    rows = withRank.filter((r) => codeSet.has(r.privyId));
  } else {
    rows = withRank.slice(0, 50);
  }

  // Make sure the viewer's own row is always present, even off the top 50
  // or outside the friends list, so "your rank" is never a dead end.
  if (viewerPrivyId && !rows.some((r) => r.privyId === viewerPrivyId)) {
    const own = withRank.find((r) => r.privyId === viewerPrivyId);
    if (own) rows = [...rows, own];
  }

  return NextResponse.json({
    rows: rows.map((r) => ({
      rank: r.rank,
      nickname: r.nickname,
      points: r.lifetimePoints,
      bestStreak: r.bestStreak,
      isMe: r.privyId === viewerPrivyId,
      code: r.privyId,
    })),
  });
}
