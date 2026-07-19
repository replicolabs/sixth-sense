"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";
import { useEffect, useRef } from "react";

/**
 * Fires once per session right after a Solana embedded wallet exists,
 * upserting the User row via /api/users/sync. Keeps the DB in sync with
 * Privy without a dedicated onboarding screen yet (Phase 6 territory) —
 * every authenticated user with a wallet gets a durable row from their
 * very first login.
 */
export function useSyncUser() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const synced = useRef(false);

  useEffect(() => {
    if (!authenticated || !user || wallets.length === 0 || synced.current) return;
    synced.current = true;

    fetch("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyId: user.id, walletAddress: wallets[0].address }),
    }).catch((err) => {
      console.error("User sync failed:", err);
      synced.current = false; // allow retry on next render
    });
  }, [authenticated, user, wallets]);
}
