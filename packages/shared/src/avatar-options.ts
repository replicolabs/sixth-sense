/** EXPANSION.md Section 1.1 avatar customization option sets. */

export interface AvatarOption {
  id: string;
  label: string;
}

/** A spectrum, not a binary choice (Section 1.1). */
export const SKIN_TONES: (AvatarOption & { color: string })[] = [
  { id: "tone-1", label: "Deepest", color: "#3B2417" },
  { id: "tone-2", label: "Deep", color: "#54331F" },
  { id: "tone-3", label: "Rich", color: "#6E4429" },
  { id: "tone-4", label: "Warm deep", color: "#8A5A35" },
  { id: "tone-5", label: "Warm medium", color: "#A9764A" },
  { id: "tone-6", label: "Medium", color: "#C99368" },
  { id: "tone-7", label: "Light", color: "#E0B594" },
  { id: "tone-8", label: "Lightest", color: "#F2D6BC" },
];

/** Includes bald/shaved per Section 1.1. */
export const HAIR_STYLES: AvatarOption[] = [
  { id: "bald", label: "Bald" },
  { id: "buzz", label: "Buzz cut" },
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
  { id: "curly", label: "Curly" },
  { id: "afro", label: "Afro" },
  { id: "mohawk", label: "Mohawk" },
];

export const HAIR_COLORS: (AvatarOption & { color: string })[] = [
  { id: "black", label: "Black", color: "#1B1B1B" },
  { id: "brown", label: "Brown", color: "#4A2E1D" },
  { id: "blonde", label: "Blonde", color: "#D9B872" },
  { id: "red", label: "Red", color: "#A5432B" },
  { id: "gray", label: "Gray", color: "#9A9A9A" },
  { id: "white", label: "White", color: "#F2F2F2" },
  { id: "blue", label: "Blue", color: "#2A6FDB" },
  { id: "pink", label: "Pink", color: "#E85DA0" },
];

export const FACIAL_HAIR_STYLES: AvatarOption[] = [
  { id: "none", label: "None" },
  { id: "stubble", label: "Stubble" },
  { id: "short-beard", label: "Short beard" },
  { id: "full-beard", label: "Full beard" },
  { id: "mustache", label: "Mustache" },
  { id: "goatee", label: "Goatee" },
];

/** Never a forced binary (Section 1.1). */
export const PRESENTATION_OPTIONS: AvatarOption[] = [
  { id: "male", label: "Male" },
  { id: "female", label: "Female" },
  { id: "neutral", label: "Prefer not to say" },
];
