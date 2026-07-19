"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets, useStandardSignAndSendTransaction } from "@privy-io/react-auth/solana";
// Deep import (not the package barrel) — the barrel also re-exports
// pool-chain.ts, which pulls in @coral-xyz/anchor's Node-oriented `Wallet`
// class. That class doesn't resolve in a browser bundle, so client code
// must only ever reach the pure, browser-safe instruction builders here.
import { buildJoinPoolTransaction } from "@sixth-sense/txline/pool-instructions";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useState } from "react";

/**
 * EXPANSION.md Section 4.7: the join flow is "pick a stake amount, confirm,
 * funds move" with no separate crypto-facing screens. This is the ONLY
 * place in the app where a normal user's own embedded wallet signs a
 * transaction directly — every other on-chain write in this app runs
 * server/service-wallet-side. `showWalletUIs: false` on the Privy provider
 * (see PrivyProviders.tsx) keeps this invisible: no second wallet popup on
 * top of our own confirm button.
 */
export function useJoinPool() {
  const { user } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const { signAndSendTransaction } = useStandardSignAndSendTransaction();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function joinPool(pool: {
    poolIdOnChain: string;
    poolConfigAddress: string;
    vaultAddress: string;
    tokenMint: string;
    amount: bigint;
  }): Promise<{ joined?: boolean; alreadyJoined?: boolean }> {
    const wallet = wallets[0];
    if (!wallet || !user) throw new Error("Sign in first");

    setJoining(true);
    setError(null);
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const userPubkey = new PublicKey(wallet.address);

      const tx = await buildJoinPoolTransaction(connection, {
        user: userPubkey,
        poolConfig: new PublicKey(pool.poolConfigAddress),
        vault: new PublicKey(pool.vaultAddress),
        tokenMint: new PublicKey(pool.tokenMint),
        amount: pool.amount,
      });

      const chain = process.env.NEXT_PUBLIC_SOLANA_CLUSTER === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
      const { signature } = await signAndSendTransaction({
        transaction: tx.serialize({ requireAllSignatures: false, verifySignatures: false }),
        wallet,
        chain,
      });
      const txSig = bs58.encode(signature);

      await connection.confirmTransaction(
        { signature: txSig, blockhash: tx.recentBlockhash!, lastValidBlockHeight: tx.lastValidBlockHeight! },
        "confirmed",
      );

      const res = await fetch(`/api/pools/${pool.poolIdOnChain}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, txSig }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not confirm your stake");
      return body;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      throw err;
    } finally {
      setJoining(false);
    }
  }

  return { joinPool, joining, error };
}
