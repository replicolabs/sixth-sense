import { prisma } from "@sixth-sense/db";
import { NextResponse } from "next/server";

/**
 * CLAUDE.md Section 11.1: the real "Enter your name" step. Separate from
 * /api/users/sync (which only ever upserts the placeholder nickname and
 * the wallet address on every login) so a returning user's session sync
 * never accidentally stomps a nickname they already picked. `hasOnboarded`
 * is the durable signal the client checks to decide whether to route a
 * signed-in user into the onboarding flow at all.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { privyId, nickname } = body as { privyId?: string; nickname?: string };

  const trimmed = nickname?.trim() ?? "";
  if (!privyId || trimmed.length < 2 || trimmed.length > 24) {
    return NextResponse.json({ error: "privyId is required and nickname must be 2-24 characters" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { privyId },
    data: { nickname: trimmed, hasOnboarded: true },
  });

  return NextResponse.json({ nickname: user.nickname, hasOnboarded: user.hasOnboarded });
}
