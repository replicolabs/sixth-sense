"use client";

import { useSyncUser } from "@/hooks/useSyncUser";

/** Renders nothing — just runs useSyncUser inside the Privy context. */
export function AuthSync() {
  useSyncUser();
  return null;
}
