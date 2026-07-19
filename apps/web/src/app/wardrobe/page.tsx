"use client";

import { usePrivy } from "@privy-io/react-auth";
import {
  CLUB_KIT_CATALOG,
  nationalKitId,
  nationalKitColors,
  resolveKitColors,
  type UnlockConditionType,
} from "@sixth-sense/shared";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AvatarPreview } from "@/components/AvatarPreview";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ProgressRing } from "@/components/ProgressRing";

interface WardrobeData {
  nationalityCode: string | null;
  equippedKitId: string | null;
  unlockedKitIds: string[];
  stats: { sessionStreak: number; lifetimeWins: number; matchesPlayed: number; xpLevel: number };
}

interface AvatarAppearance {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
}

function conditionLabel(type: UnlockConditionType, threshold: number): string {
  switch (type) {
    case "sessionStreak":
      return `Streak of ${threshold} in one match`;
    case "lifetimeWins":
      return `${threshold} lifetime calls won`;
    case "matchesPlayed":
      return `Play ${threshold} matches`;
    case "xpLevel":
      return `Reach level ${threshold}`;
  }
}

function statFor(type: UnlockConditionType, stats: WardrobeData["stats"]): number {
  switch (type) {
    case "sessionStreak":
      return stats.sessionStreak;
    case "lifetimeWins":
      return stats.lifetimeWins;
    case "matchesPlayed":
      return stats.matchesPlayed;
    case "xpLevel":
      return stats.xpLevel;
  }
}

export default function WardrobePage() {
  const { user, authenticated, login } = usePrivy();
  const [wardrobe, setWardrobe] = useState<WardrobeData | null>(null);
  const [appearance, setAppearance] = useState<AvatarAppearance | null>(null);
  const [equipping, setEquipping] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/wardrobe?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setWardrobe);
    fetch(`/api/avatar?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((avatar) => avatar && setAppearance(avatar));
  }, [user]);

  async function equip(kitId: string) {
    if (!user || equipping) return;
    setEquipping(kitId);
    try {
      const res = await fetch("/api/wardrobe/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, kitId }),
      });
      if (res.ok) {
        setWardrobe((prev) => (prev ? { ...prev, equippedKitId: kitId } : prev));
      }
    } finally {
      setEquipping(null);
    }
  }

  if (!authenticated) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4">
        <p className="text-sm text-[var(--ink-500)]">Sign in to see your kits.</p>
        <button
          onClick={login}
          className="rounded-[var(--r-pill)] bg-[var(--volt-500)] px-6 py-3 font-semibold text-[var(--ink-900)]"
        >
          Sign in
        </button>
      </main>
    );
  }

  if (!wardrobe || !appearance) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-10 pt-6">
        <p className="text-center text-sm text-[var(--ink-500)]">Loading your kits…</p>
      </main>
    );
  }

  const kitColors = resolveKitColors(wardrobe.equippedKitId, wardrobe.nationalityCode ?? "US");
  const natKitId = nationalKitId(wardrobe.nationalityCode ?? "US");
  const natColors = nationalKitColors(wardrobe.nationalityCode ?? "US");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
          Kits
        </span>
        <Link href="/avatar" className="text-sm font-medium text-[var(--pine-700)]">
          Edit avatar
        </Link>
      </header>

      <div className="flex justify-center">
        <GlassPanel radius="xl" className="p-6">
          <AvatarPreview
            skinTone={appearance.skinTone}
            hairStyle={appearance.hairStyle}
            hairColor={appearance.hairColor}
            facialHair={appearance.facialHair}
            kitPrimaryColor={kitColors.primary}
            kitSecondaryColor={kitColors.secondary}
          />
        </GlassPanel>
      </div>

      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
        National kit
      </p>
      <button
        onClick={() => equip(natKitId)}
        disabled={equipping !== null}
        className={`flex items-center justify-between rounded-[var(--r-md)] px-4 py-3 text-left ${
          wardrobe.equippedKitId === natKitId ? "bg-[var(--volt-500)]/20" : "bg-[var(--cream-sunken)]"
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className="h-8 w-8 rounded-full border border-[var(--hairline)]"
            style={{ background: `linear-gradient(135deg, ${natColors.primary} 50%, ${natColors.secondary} 50%)` }}
          />
          <span className="font-semibold text-[var(--ink-900)]">Home nation</span>
        </div>
        <span className="text-xs text-[var(--ink-500)]">
          {wardrobe.equippedKitId === natKitId ? "Equipped" : "Equip"}
        </span>
      </button>

      <p className="mb-1 mt-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
        Club-inspired kits
      </p>
      <div className="flex flex-col gap-2">
        {CLUB_KIT_CATALOG.map((kit) => {
          const unlocked = wardrobe.unlockedKitIds.includes(kit.id);
          const equipped = wardrobe.equippedKitId === kit.id;
          const progress = statFor(kit.unlock.type, wardrobe.stats) / kit.unlock.threshold;

          return (
            <button
              key={kit.id}
              onClick={() => unlocked && equip(kit.id)}
              disabled={!unlocked || equipping !== null}
              className={`flex items-center justify-between rounded-[var(--r-md)] px-4 py-3 text-left ${
                equipped ? "bg-[var(--volt-500)]/20" : "bg-[var(--cream-sunken)]"
              } ${!unlocked ? "opacity-60" : ""}`}
            >
              <div className="flex items-center gap-3">
                {unlocked ? (
                  <span
                    className="h-8 w-8 rounded-full border border-[var(--hairline)]"
                    style={{ background: `linear-gradient(135deg, ${kit.primaryColor} 50%, ${kit.secondaryColor} 50%)` }}
                  />
                ) : (
                  <div className="relative flex h-8 w-8 items-center justify-center">
                    <ProgressRing fraction={progress} size={32} />
                    <span className="absolute text-xs">🔒</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-[var(--ink-900)]">{kit.name}</p>
                  {!unlocked && (
                    <p className="text-xs text-[var(--ink-400)]">
                      {conditionLabel(kit.unlock.type, kit.unlock.threshold)}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-xs text-[var(--ink-500)]">
                {equipped ? "Equipped" : unlocked ? "Equip" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}
