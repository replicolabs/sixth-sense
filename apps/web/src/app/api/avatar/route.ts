import { prisma } from "@sixth-sense/db";
import { nationalKitId } from "@sixth-sense/shared";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const privyId = new URL(request.url).searchParams.get("privyId");
  if (!privyId) {
    return NextResponse.json({ error: "privyId query param is required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { privyId }, include: { avatar: true } });
  if (!user?.avatar) {
    return NextResponse.json(null, { status: 404 });
  }
  return NextResponse.json(user.avatar);
}

interface AvatarPayload {
  privyId: string;
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  presentation: "male" | "female" | "neutral";
  nationalityCode: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as AvatarPayload;
  const { privyId, skinTone, hairStyle, hairColor, facialHair, presentation, nationalityCode } = body;

  if (!privyId || !skinTone || !hairStyle || !hairColor || !facialHair || !presentation || !nationalityCode) {
    return NextResponse.json({ error: "all avatar fields are required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { privyId } });
  if (!user) {
    return NextResponse.json({ error: "user not found — sync login first" }, { status: 404 });
  }

  const avatar = await prisma.avatar.upsert({
    where: { userId: user.id },
    update: { skinTone, hairStyle, hairColor, facialHair, presentation, nationalityCode },
    create: {
      userId: user.id,
      skinTone,
      hairStyle,
      hairColor,
      facialHair,
      presentation,
      nationalityCode,
      equippedAccessoryIds: [],
    },
  });

  // National kits unlock immediately based on nationality (Section 1.3) —
  // grant it here rather than requiring a separate action, so setting your
  // nationality always comes with your kit already earned.
  await prisma.kitUnlock.upsert({
    where: { userId_kitId: { userId: user.id, kitId: nationalKitId(nationalityCode) } },
    update: {},
    create: {
      userId: user.id,
      kitId: nationalKitId(nationalityCode),
      unlockedVia: "event",
    },
  });

  return NextResponse.json(avatar);
}
