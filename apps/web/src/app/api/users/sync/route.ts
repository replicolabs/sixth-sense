import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * Called once right after Privy login (client-side, see useSyncUser).
 * Upserts a User row keyed on privyId — first login creates the row with
 * a placeholder nickname, later logins just confirm the wallet address
 * still matches. Real nickname/avatar picking is the onboarding screen
 * (Section 11.1), not built yet; this just makes sure a durable User
 * record exists the moment someone authenticates, per CLAUDE.md Section 8
 * ("confirm a Solana wallet address exists after first login and store it
 * on the User record").
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
  });
}
