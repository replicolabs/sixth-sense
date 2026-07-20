import {
  COUNTRIES,
  HAIR_COLORS,
  HAIR_STYLES,
  PRESENTATION_OPTIONS,
  resolveKitColors,
  SKIN_TONES,
} from "@sixth-sense/shared";
import { AvatarPreview } from "@/components/AvatarPreview";
import { LabelOptionRow, SwatchOptionRow } from "@/components/OptionRow";

export interface AvatarBuilderValue {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  presentation: string;
  nationalityCode: string;
}

interface AvatarBuilderFormProps {
  value: AvatarBuilderValue;
  onChange: (value: AvatarBuilderValue) => void;
  equippedKitId?: string | null;
}

/**
 * The avatar builder's fields + live preview, shared by the standalone
 * `/avatar` edit screen and onboarding's "Pick your look" step (Section
 * 11.1), one source of truth for the form instead of two copies drifting
 * apart. Callers own persistence (each screen saves differently: the edit
 * screen has its own explicit Save button and fetch-on-mount; onboarding
 * saves once at the end of the wizard).
 */
export function AvatarBuilderForm({ value, onChange, equippedKitId = null }: AvatarBuilderFormProps) {
  const set = <K extends keyof AvatarBuilderValue>(key: K) => (v: AvatarBuilderValue[K]) =>
    onChange({ ...value, [key]: v });

  const kitColors = resolveKitColors(equippedKitId, value.nationalityCode);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-center">
        <div className="glass-panel rounded-[var(--r-xl)] p-6">
          <AvatarPreview
            skinTone={value.skinTone}
            hairStyle={value.hairStyle}
            hairColor={value.hairColor}
            facialHair={value.facialHair}
            kitPrimaryColor={kitColors.primary}
            kitSecondaryColor={kitColors.secondary}
          />
        </div>
      </div>

      <SwatchOptionRow title="Skin tone" options={SKIN_TONES} value={value.skinTone} onChange={set("skinTone")} />
      <LabelOptionRow title="Hair" options={HAIR_STYLES} value={value.hairStyle} onChange={set("hairStyle")} />
      <SwatchOptionRow title="Hair color" options={HAIR_COLORS} value={value.hairColor} onChange={set("hairColor")} />
      <LabelOptionRow
        title="Presentation"
        options={PRESENTATION_OPTIONS}
        value={value.presentation}
        onChange={set("presentation")}
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
          value={value.nationalityCode}
          onChange={(e) => set("nationalityCode")(e.target.value)}
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
    </div>
  );
}
