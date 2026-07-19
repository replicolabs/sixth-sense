"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { AuthSync } from "./AuthSync";

/**
 * Wraps the app with Privy for invisible auth + embedded Solana wallets
 * (CLAUDE.md Section 8). Email/social login auto-creates a Solana wallet
 * for users who don't have one — the user never sees wallet UI.
 *
 * Confirmed against the installed @privy-io/react-auth@2.25.0 type defs
 * (docs were inconsistent: one page showed a flat, deprecated
 * `embeddedWallets.createOnLogin` which only ever applies to Ethereum).
 * The real, current shape nests createOnLogin per chain.
 */
export function PrivyProviders({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error("NEXT_PUBLIC_PRIVY_APP_ID is not set");
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ["email", "google"],
        appearance: {
          walletChainType: "solana-only",
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "users-without-wallets",
          },
          // CLAUDE.md Section 8 / EXPANSION.md Section 4.7: the user signs
          // by confirming a dollar amount in OUR UI, never a second
          // blockchain-flavored modal on top of it — this is a sibling of
          // `solana`, not nested inside it (confirmed against the installed
          // type defs), and suppresses Privy's own transaction-approval
          // popup so staking a pool stays a single, invisible confirmation.
          showWalletUIs: false,
        },
      }}
    >
      <AuthSync />
      {children}
    </PrivyProvider>
  );
}
