/**
 * EXPANSION.md Section 1.2/1.3 — the stylized kit universe. Every
 * club-inspired kit here is an ORIGINAL name/badge/color-story, never a
 * real crest or club name — see EXPANSION.md Section 1.2 for why that
 * split matters (identification elsewhere in the app uses real assets;
 * anything wearable/unlockable stays original).
 */

export type UnlockConditionType =
  | "sessionStreak"
  | "lifetimeWins"
  | "matchesPlayed"
  | "xpLevel";

export interface UnlockCondition {
  type: UnlockConditionType;
  threshold: number;
}

export interface ClubKit {
  id: string;
  name: string;
  /** What real club this evokes, for our own internal reference only — never shown to users as a real name/crest. */
  evokes: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  unlock: UnlockCondition;
}

/** Six original kits, each gated behind a distinct milestone (Section 1.3). */
export const CLUB_KIT_CATALOG: ClubKit[] = [
  {
    id: "old-trafford-red",
    name: "Old Trafford Red",
    evokes: "Man United",
    primaryColor: "#DA020E",
    secondaryColor: "#000000",
    accentColor: "#FFD700",
    unlock: { type: "sessionStreak", threshold: 5 },
  },
  {
    id: "sky-blue-xi",
    name: "Sky Blue XI",
    evokes: "Man City",
    primaryColor: "#6CABDD",
    secondaryColor: "#FFFFFF",
    unlock: { type: "sessionStreak", threshold: 10 },
  },
  {
    id: "kop-reds",
    name: "The Kop Reds",
    evokes: "Liverpool",
    primaryColor: "#C8102E",
    secondaryColor: "#F6EB61",
    unlock: { type: "lifetimeWins", threshold: 50 },
  },
  {
    id: "capital-white",
    name: "Capital White",
    evokes: "Real Madrid",
    primaryColor: "#FFFFFF",
    secondaryColor: "#FEBE10",
    unlock: { type: "matchesPlayed", threshold: 10 },
  },
  {
    id: "bridge-blues",
    name: "Bridge Blues",
    evokes: "Chelsea",
    primaryColor: "#034694",
    secondaryColor: "#FFFFFF",
    unlock: { type: "xpLevel", threshold: 10 },
  },
  {
    id: "blaugrana",
    name: "Blaugrana",
    evokes: "Barcelona",
    primaryColor: "#A50044",
    secondaryColor: "#004D98",
    // A sixth, harder milestone since Section 1.3's example only listed
    // five explicit tiers for what it called an illustrative ladder.
    unlock: { type: "matchesPlayed", threshold: 25 },
  },
];

/**
 * Real, common-knowledge national kit color associations (public
 * knowledge, not a copyrighted design) — Section 1.2: "national team kits
 * are lower risk since flags and national colors are not enforced."
 * Deliberately not exhaustive; unlisted countries fall back to a neutral
 * default rather than breaking.
 */
export const NATIONAL_KIT_COLORS: Record<string, { primary: string; secondary: string }> = {
  BR: { primary: "#FFDF00", secondary: "#009739" }, // Brazil
  AR: { primary: "#75AADB", secondary: "#FFFFFF" }, // Argentina
  FR: { primary: "#002395", secondary: "#FFFFFF" }, // France
  GB: { primary: "#FFFFFF", secondary: "#CE1124" }, // England
  DE: { primary: "#FFFFFF", secondary: "#000000" }, // Germany
  ES: { primary: "#C60B1E", secondary: "#FFC400" }, // Spain
  IT: { primary: "#0066CC", secondary: "#FFFFFF" }, // Italy
  PT: { primary: "#CE1126", secondary: "#006600" }, // Portugal
  NL: { primary: "#FF6600", secondary: "#FFFFFF" }, // Netherlands
  BE: { primary: "#ED1C24", secondary: "#000000" }, // Belgium
  HR: { primary: "#FF0000", secondary: "#FFFFFF" }, // Croatia
  UY: { primary: "#7DB9E8", secondary: "#FFFFFF" }, // Uruguay
  MX: { primary: "#006847", secondary: "#FFFFFF" }, // Mexico
  US: { primary: "#002868", secondary: "#FFFFFF" }, // USA
  JP: { primary: "#0066CC", secondary: "#FFFFFF" }, // Japan
  KR: { primary: "#FFFFFF", secondary: "#C60C30" }, // South Korea
  MA: { primary: "#C1272D", secondary: "#006233" }, // Morocco
  SN: { primary: "#00853F", secondary: "#FDEF42" }, // Senegal
  NG: { primary: "#008751", secondary: "#FFFFFF" }, // Nigeria
  GH: { primary: "#FFFFFF", secondary: "#000000" }, // Ghana
  CM: { primary: "#007A5E", secondary: "#CE1126" }, // Cameroon
  EG: { primary: "#FFFFFF", secondary: "#CE1126" }, // Egypt
  AU: { primary: "#FFD200", secondary: "#00843D" }, // Australia
  CA: { primary: "#FF0000", secondary: "#FFFFFF" }, // Canada
  EC: { primary: "#FFDA00", secondary: "#034EA2" }, // Ecuador
  CO: { primary: "#FCD116", secondary: "#003893" }, // Colombia
  CL: { primary: "#D52B1E", secondary: "#FFFFFF" }, // Chile
  PE: { primary: "#FFFFFF", secondary: "#D91023" }, // Peru
  PL: { primary: "#FFFFFF", secondary: "#DC143C" }, // Poland
  CH: { primary: "#FF0000", secondary: "#FFFFFF" }, // Switzerland
  DK: { primary: "#C60C30", secondary: "#FFFFFF" }, // Denmark
  SE: { primary: "#FECC02", secondary: "#004B87" }, // Sweden
  NO: { primary: "#EF2B2D", secondary: "#FFFFFF" }, // Norway
  TR: { primary: "#E30A17", secondary: "#FFFFFF" }, // Turkey
  SA: { primary: "#006C35", secondary: "#FFFFFF" }, // Saudi Arabia
  QA: { primary: "#8A1538", secondary: "#FFFFFF" }, // Qatar
  VN: { primary: "#DA251D", secondary: "#FFFF00" }, // Vietnam
  MM: { primary: "#FECB00", secondary: "#34B233" }, // Myanmar
  NZ: { primary: "#000000", secondary: "#FFFFFF" }, // New Zealand
  IN: { primary: "#FF9933", secondary: "#138808" }, // India
};

export const DEFAULT_NATIONAL_KIT_COLORS = { primary: "#5E6E66", secondary: "#F6F2E9" };

export function nationalKitId(nationalityCode: string): string {
  return `national-${nationalityCode.toLowerCase()}`;
}

export function nationalKitColors(nationalityCode: string): { primary: string; secondary: string } {
  return NATIONAL_KIT_COLORS[nationalityCode.toUpperCase()] ?? DEFAULT_NATIONAL_KIT_COLORS;
}

/**
 * Single source of truth for "what colors does this avatar's jersey show
 * right now" — checks the club-inspired catalog first, falls back to the
 * national kit for `nationalityCode` (the always-available starter,
 * EXPANSION.md Section 1.3), and never leaves an equipped-but-unresolvable
 * kit id looking broken.
 */
export function resolveKitColors(
  equippedKitId: string | null | undefined,
  nationalityCode: string,
): { primary: string; secondary: string } {
  if (equippedKitId) {
    const club = CLUB_KIT_CATALOG.find((k) => k.id === equippedKitId);
    if (club) return { primary: club.primaryColor, secondary: club.secondaryColor };
  }
  return nationalKitColors(nationalityCode);
}
