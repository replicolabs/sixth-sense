import { HAIR_COLORS, SKIN_TONES } from "@sixth-sense/shared";

export interface AvatarPreviewProps {
  skinTone: string;
  hairStyle: string;
  hairColor: string;
  facialHair: string;
  kitPrimaryColor?: string;
  kitSecondaryColor?: string;
  size?: number;
}

function colorFor(list: { id: string; color: string }[], id: string, fallback: string): string {
  return list.find((o) => o.id === id)?.color ?? fallback;
}

/**
 * A simple, playful, iconographic avatar (Section 10.6: "a set of playful,
 * football-flavored avatar shapes," not photorealistic art) built entirely
 * from SVG primitives so it needs no external image assets.
 */
export function AvatarPreview({
  skinTone,
  hairStyle,
  hairColor,
  facialHair,
  kitPrimaryColor = "var(--pine-700)",
  kitSecondaryColor = "var(--cream)",
  size = 160,
}: AvatarPreviewProps) {
  const skin = colorFor(SKIN_TONES, skinTone, SKIN_TONES[4].color);
  const hair = colorFor(HAIR_COLORS, hairColor, HAIR_COLORS[0].color);

  return (
    <svg width={size} height={size} viewBox="0 0 160 160" role="img" aria-label="Your avatar preview">
      {/* jersey collar */}
      <path d="M40 160 Q80 130 120 160 L120 175 L40 175 Z" fill={kitPrimaryColor} />
      <path d="M65 150 Q80 165 95 150 L95 160 Q80 172 65 160 Z" fill={kitSecondaryColor} />

      {/* neck */}
      <rect x="68" y="105" width="24" height="24" rx="6" fill={skin} />

      {/* head */}
      <circle cx="80" cy="75" r="42" fill={skin} />

      {/* facial hair */}
      {facialHair === "stubble" && <circle cx="80" cy="90" r="30" fill={hair} opacity="0.15" />}
      {facialHair === "short-beard" && (
        <path d="M48 80 Q80 130 112 80 Q112 105 80 112 Q48 105 48 80 Z" fill={hair} opacity="0.9" />
      )}
      {facialHair === "full-beard" && (
        <path d="M42 72 Q80 140 118 72 Q120 110 80 118 Q40 110 42 72 Z" fill={hair} />
      )}
      {facialHair === "mustache" && (
        <path d="M62 88 Q80 96 98 88 Q90 94 80 94 Q70 94 62 88 Z" fill={hair} />
      )}
      {facialHair === "goatee" && <path d="M65 98 Q80 118 95 98 Q95 108 80 112 Q65 108 65 98 Z" fill={hair} />}

      {/* eyes */}
      <circle cx="65" cy="72" r="4" fill="var(--ink-900)" />
      <circle cx="95" cy="72" r="4" fill="var(--ink-900)" />

      {/* hair */}
      {hairStyle === "bald" && null}
      {hairStyle === "buzz" && <path d="M38 60 Q80 28 122 60 Q122 45 80 40 Q38 45 38 60 Z" fill={hair} />}
      {hairStyle === "short" && <path d="M34 62 Q80 18 126 62 Q126 40 80 34 Q34 40 34 62 Z" fill={hair} />}
      {hairStyle === "medium" && (
        <path d="M32 78 Q28 30 80 26 Q132 30 128 78 Q120 50 80 46 Q40 50 32 78 Z" fill={hair} />
      )}
      {hairStyle === "long" && (
        <path d="M30 110 Q22 30 80 24 Q138 30 130 110 L118 110 Q124 50 80 42 Q36 50 42 110 Z" fill={hair} />
      )}
      {hairStyle === "curly" && (
        <g fill={hair}>
          <circle cx="45" cy="50" r="12" />
          <circle cx="62" cy="35" r="13" />
          <circle cx="80" cy="30" r="13" />
          <circle cx="98" cy="35" r="13" />
          <circle cx="115" cy="50" r="12" />
        </g>
      )}
      {hairStyle === "afro" && <circle cx="80" cy="52" r="46" fill={hair} />}
      {hairStyle === "mohawk" && <path d="M68 20 L92 20 L88 60 L72 60 Z" fill={hair} />}
    </svg>
  );
}
