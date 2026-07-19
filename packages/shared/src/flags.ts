import { COUNTRIES } from "./countries";

/**
 * EXPANSION.md Section 1.4: real national flags for identification
 * (scoreboard, match rows, Classics search), sourced from flagcdn.com —
 * confirmed real: flag images are public domain ("can be used freely
 * without restriction" per flagpedia.net's terms), free, no API key, no
 * attribution required. Club crests are deliberately NOT covered here —
 * the free tiers of the sports-data providers EXPANSION suggests
 * (TheSportsDB etc.) have ambiguous commercial terms, and every real
 * fixture this app has ever handled is an international match anyway, so
 * there's nothing to test a club-crest integration against yet.
 *
 * Football's real national teams don't map 1:1 onto ISO 3166-1 (England,
 * Scotland, Wales, and Northern Ireland each field their own team, but
 * ISO only has "GB" for the whole UK) — confirmed empirically that
 * flagcdn does serve these as ISO 3166-2 subdivision codes
 * (gb-eng/gb-sct/gb-wls/gb-nir all return real flag images), so they're
 * special-cased ahead of the plain COUNTRIES lookup.
 */
const FOOTBALL_NAME_OVERRIDES: Record<string, string> = {
  england: "gb-eng",
  scotland: "gb-sct",
  wales: "gb-wls",
  "northern ireland": "gb-nir",
};

function normalize(name: string): string {
  return name.trim().toLowerCase();
}

/** Returns a lowercase ISO code (or ISO-3166-2-style subdivision code) flagcdn expects, or null if unresolved. */
export function resolveFlagCode(teamName: string): string | null {
  const key = normalize(teamName);
  if (FOOTBALL_NAME_OVERRIDES[key]) return FOOTBALL_NAME_OVERRIDES[key];

  const match = COUNTRIES.find((c) => normalize(c.name) === key);
  return match ? match.code.toLowerCase() : null;
}

export function buildFlagUrl(code: string, widthPx: 40 | 80 | 160 = 80): string {
  return `https://flagcdn.com/w${widthPx}/${code}.png`;
}

/** Convenience: resolve straight to a renderable URL, or null if the team name isn't a recognized country/football nation. */
export function resolveFlagUrl(teamName: string, widthPx: 40 | 80 | 160 = 80): string | null {
  const code = resolveFlagCode(teamName);
  return code ? buildFlagUrl(code, widthPx) : null;
}
