"use client";

import { useEffect, useState } from "react";

// Module-level cache shared across every component instance in the
// session — a flag URL never changes mid-session, so there's no reason
// to re-fetch it for every row that happens to show the same team.
const flagCache = new Map<string, string | null>();
const inFlight = new Map<string, Promise<string | null>>();

async function fetchFlagUrl(txlineTeamId: string, teamName: string): Promise<string | null> {
  if (flagCache.has(txlineTeamId)) return flagCache.get(txlineTeamId)!;
  if (inFlight.has(txlineTeamId)) return inFlight.get(txlineTeamId)!;

  const promise = fetch(
    `/api/team-assets/resolve?txlineTeamId=${encodeURIComponent(txlineTeamId)}&teamName=${encodeURIComponent(teamName)}`,
  )
    .then((res) => (res.ok ? res.json() : { flagUrl: null }))
    .then((body) => body.flagUrl as string | null)
    .catch(() => null)
    .finally(() => inFlight.delete(txlineTeamId));

  inFlight.set(txlineTeamId, promise);
  const result = await promise;
  flagCache.set(txlineTeamId, result);
  return result;
}

/** EXPANSION.md Section 1.4 — real flags for identification, cached client-side per team id for the session. */
export function useTeamFlag(txlineTeamId: string | undefined, teamName: string | undefined): string | null {
  const [flagUrl, setFlagUrl] = useState<string | null>(
    txlineTeamId && flagCache.has(txlineTeamId) ? flagCache.get(txlineTeamId)! : null,
  );

  useEffect(() => {
    if (!txlineTeamId || !teamName) return;
    if (flagCache.has(txlineTeamId)) {
      setFlagUrl(flagCache.get(txlineTeamId)!);
      return;
    }
    let cancelled = false;
    fetchFlagUrl(txlineTeamId, teamName).then((url) => {
      if (!cancelled) setFlagUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [txlineTeamId, teamName]);

  return flagUrl;
}
