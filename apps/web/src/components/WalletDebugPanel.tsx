"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets } from "@privy-io/react-auth/solana";

/**
 * Dev-only panel confirming the invisible embedded Solana wallet actually
 * gets created (CLAUDE.md Section 8: "A hidden developer/debug panel (only
 * in dev builds) may show it for testing"). Never render this in
 * production — the wallet address must never surface in the default UI.
 *
 * Uses `useConnectedStandardWallets` (confirmed against the installed
 * @privy-io/react-auth@2.25.0 types) — the older `useSolanaWallets` hook is
 * deprecated in this version.
 */
export function WalletDebugPanel() {
  const { ready, authenticated, login, logout, user } = usePrivy();
  const { wallets } = useConnectedStandardWallets();

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div className="mt-6 rounded-[var(--r-md)] border border-dashed border-[var(--hairline)] p-4 font-mono text-xs text-[var(--ink-500)]">
      <p className="mb-2 font-sans font-semibold text-[var(--ink-700)]">
        Dev only — wallet debug panel
      </p>
      <p>ready: {String(ready)}</p>
      <p>authenticated: {String(authenticated)}</p>
      <p>privyId: {user?.id ?? "-"}</p>
      <p>solana wallets: {wallets.length}</p>
      {wallets.map((w) => (
        <p key={w.address}>address: {w.address}</p>
      ))}
      <div className="mt-3 flex gap-2">
        {!authenticated ? (
          <button className="underline" onClick={login}>
            Sign in
          </button>
        ) : (
          <button className="underline" onClick={logout}>
            Sign out
          </button>
        )}
      </div>
    </div>
  );
}
