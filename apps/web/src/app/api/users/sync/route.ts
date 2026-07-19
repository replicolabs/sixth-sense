import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * Called once right after Privy login (client-side, see useSyncUser).
 * Upserts a User row keyed on privyId — first login creates the row with
 * a placeholder nickname and hasOnboarded: false, later logins just
 * confirm the wallet address still matches (never touches nickname or
 * hasOnboarded again — that's /api/onboarding/complete's job, once, from
 * the real onboarding flow, Section 11.1). Returning hasOnboarded here
 * lets useSyncUser decide whether to route a signed-in user into
 * onboarding, right after this upsert guarantees the row exists, per
 * CLAUDE.md Section 8 ("confirm a Solana wallet address exists after
 * first login and store it on the User record").
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { privyId, walletAddress } = body as { privyId?: string; walletAddress?: string };

  if (!privyId || !walletAddress) {
    return NextResponse.json({ error: "privyId and walletAddress are required" }, { status: 400 });
  }

  const user = await prisma.user.upsert({
    where: { privyId },
    update: { walletAddress },
    create: {
      privyId,
      walletAddress,
      nickname: `Player-${privyId.slice(-6)}`,
    },
  });

  return NextResponse.json({
    id: user.id,
    nickname: user.nickname,
    xp: user.xp,
    level: user.level,
    hasOnboarded: user.hasOnboarded,
  });
}
