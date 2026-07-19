"use client";

import {
  COUNTRIES,
  FACIAL_HAIR_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  PRESENTATION_OPTIONS,
  resolveKitColors,
  SKIN_TONES,
} from "@sixth-sense/shared";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { AvatarPreview } from "@/components/AvatarPreview";
import { PrimaryButton } from "@/components/ui/Buttons";
import { LabelOptionRow, SwatchOptionRow } from "@/components/OptionRow";

/**
 * Section 1.1: a single-screen avatar builder with live preview. Fast —
 * most people should finish in under a minute. Real onboarding flow
 * (email/social login -> nickname -> this -> explainer, Section 11.1)
 * isn't built yet; this screen is reachable directly for now.
 */
export default function AvatarBuilderPage() {
  const { user, authenticated } = usePrivy();

  const [skinTone, setSkinTone] = useState(SKIN_TONES[4].id);
  const [hairStyle, setHairStyle] = useState(HAIR_STYLES[2].id);
  const [hairColor, setHairColor] = useState(HAIR_COLORS[0].id);
  const [facialHair, setFacialHair] = useState(FACIAL_HAIR_STYLES[0].id);
  const [presentation, setPresentation] = useState(PRESENTATION_OPTIONS[2].id);
  const [nationalityCode, setNationalityCode] = useState("US");
  const [equippedKitId, setEquippedKitId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/avatar?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((avatar) => {
        if (!avatar) return;
        setSkinTone(avatar.skinTone);
        setHairStyle(avatar.hairStyle);
        setHairColor(avatar.hairColor);
        setFacialHair(avatar.facialHair);
        setPresentation(avatar.presentation);
        setNationalityCode(avatar.nationalityCode);
        setEquippedKitId(avatar.equippedKitId);
      })
      .catch(() => {});
  }, [user]);

  const kitColors = resolveKitColors(equippedKitId, nationalityCode);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privyId: user.id,
          skinTone,
          hairStyle,
          hairColor,
          facialHair,
          presentation,
          nationalityCode,
        }),
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

      <div className="flex justify-center">
        <div className="glass-panel rounded-[var(--r-xl)] p-6">
          <AvatarPreview
            skinTone={skinTone}
            hairStyle={hairStyle}
            hairColor={hairColor}
            facialHair={facialHair}
            kitPrimaryColor={kitColors.primary}
            kitSecondaryColor={kitColors.secondary}
          />
        </div>
      </div>

      <SwatchOptionRow title="Skin tone" options={SKIN_TONES} value={skinTone} onChange={setSkinTone} />
      <LabelOptionRow title="Hair" options={HAIR_STYLES} value={hairStyle} onChange={setHairStyle} />
      <SwatchOptionRow title="Hair color" options={HAIR_COLORS} value={hairColor} onChange={setHairColor} />
      <LabelOptionRow
        title="Facial hair"
        options={FACIAL_HAIR_STYLES}
        value={facialHair}
        onChange={setFacialHair}
      />
      <LabelOptionRow
        title="Presentation"
        options={PRESENTATION_OPTIONS}
        value={presentation}
        onChange={setPresentation}
      />

      <div>
        <label
          htmlFor="nationality"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]"
        >
          Nationality
        </label>
        <select
          id="nationality"
          value={nationalityCode}
          onChange={(e) => setNationalityCode(e.target.value)}
          className="w-full rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-4 py-2.5 text-[var(--ink-900)]"
        >
          {COUNTRIES.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-[var(--ink-400)]">
          Sets your flag and unlocks your national kit right away.
        </p>
      </div>

      <PrimaryButton onClick={handleSave} disabled={!authenticated || saving}>
        {saving ? "Saving…" : saved ? "Saved!" : "Save avatar"}
      </PrimaryButton>
    </main>
  );
}
