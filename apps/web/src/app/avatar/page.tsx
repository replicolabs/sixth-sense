"use client";

import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, FACIAL_HAIR_STYLES, PRESENTATION_OPTIONS } from "@sixth-sense/shared";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { AvatarBuilderForm, type AvatarBuilderValue } from "@/components/AvatarBuilderForm";
import { PrimaryButton } from "@/components/ui/Buttons";

const DEFAULT_VALUE: AvatarBuilderValue = {
  skinTone: SKIN_TONES[4].id,
  hairStyle: HAIR_STYLES[2].id,
  hairColor: HAIR_COLORS[0].id,
  facialHair: FACIAL_HAIR_STYLES[0].id,
  presentation: PRESENTATION_OPTIONS[2].id,
  nationalityCode: "US",
};

/**
 * Section 1.1: a single-screen avatar builder with live preview, reachable
 * any time to change your look later. First-time look picking now happens
 * in the real onboarding flow (Section 11.1, apps/web/src/app/onboarding) —
 * this screen and that step share AvatarBuilderForm rather than duplicating it.
 */
export default function AvatarBuilderPage() {
  const { user, authenticated } = usePrivy();

  const [value, setValue] = useState<AvatarBuilderValue>(DEFAULT_VALUE);
  const [equippedKitId, setEquippedKitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/avatar?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((avatar) => {
        if (!avatar) return;
        setValue({
          skinTone: avatar.skinTone,
          hairStyle: avatar.hairStyle,
          hairColor: avatar.hairColor,
          facialHair: avatar.facialHair,
          presentation: avatar.presentation,
          nationalityCode: avatar.nationalityCode,
        });
        setEquippedKitId(avatar.equippedKitId);
      })
      .catch(() => {});
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, ...value }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)]">
          Pick your look
        </h1>
        <Link href="/wardrobe" className="text-sm font-medium text-[var(--pine-700)]">
          Kits
        </Link>
      </div>

      {!authenticated && (
        <p className="text-center text-sm text-[var(--ink-500)]">Sign in to build your avatar.</p>
      )}

      <AvatarBuilderForm value={value} onChange={setValue} equippedKitId={equippedKitId} />

      <PrimaryButton onClick={handleSave} disabled={!authenticated || saving}>
        {saving ? "Saving…" : saved ? "Saved!" : "Save avatar"}
      </PrimaryButton>
    </main>
  );
}
