"use client";

import { useTeamFlag } from "@/hooks/useTeamFlag";

/**
 * EXPANSION.md Section 1.4's asset rule: real flags for identification
 * (scoreboard, match rows), stylized-only art stays confined to the kit
 * system (Section 1.2) — this component is never used for a kit/jersey.
 * Renders nothing (not a broken image) when a team can't be resolved to a
 * flag, per Section 1.4: "a broken or missing image never silently shows
 * nothing" is about the DATA layer always having a row to check; the UI
 * itself just quietly omits the icon rather than showing a broken-image
 * glyph.
 */
export function TeamFlag({
  teamId,
  teamName,
  size = 20,
}: {
  teamId: string;
  teamName: string;
  size?: number;
}) {
  const flagUrl = useTeamFlag(teamId, teamName);
  if (!flagUrl) return null;

  return (
    <img
      src={flagUrl}
      alt=""
      width={size}
      height={size * 0.75}
      className="inline-block shrink-0 rounded-[2px] object-cover"
      style={{ width: size, height: size * 0.75 }}
    />
  );
}
