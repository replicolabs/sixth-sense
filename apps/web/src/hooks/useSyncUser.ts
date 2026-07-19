"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Fires once per session right after a Solana embedded wallet exists,
 * upserting the User row via /api/users/sync. Also the one place that
 * decides whether a signed-in user needs the real onboarding flow
 * (Section 11.1) — mounted globally via AuthSync in PrivyProviders, so
 * this check runs no matter which page someone lands on after login,
 * rather than needing the same check duplicated on every page.
 */
export function useSyncUser() {
  const { authenticated, user } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const router = useRouter();
  const pathname = usePathname();
  const synced = useRef(false);

  useEffect(() => {
    if (!authenticated || !user || wallets.length === 0 || synced.current) return;
    synced.current = true;

    fetch("/api/users/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ privyId: user.id, walletAddress: wallets[0].address }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { hasOnboarded?: boolean } | null) => {
        if (body && !body.hasOnboarded && pathname !== "/onboarding") {
          router.replace("/onboarding");
        }
      })
      .catch((err) => {
        console.error("User sync failed:", err);
        synced.current = false; // allow retry on next render
      });
  }, [authenticated, user, wallets, router, pathname]);
}
