"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useConnectedStandardWallets, useStandardSignAndSendTransaction } from "@privy-io/react-auth/solana";
// See useJoinPool.ts's comment — deep import to avoid pulling the
// package barrel's Node-oriented pool-chain.ts into the browser bundle.
import { buildClaimPayoutTransaction } from "@sixth-sense/txline/pool-instructions";
import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { useState } from "react";

/** EXPANSION.md Section 4.7's settlement screen "claim button." */
export function useClaimPayout() {
  const { user } = usePrivy();
  const { wallets } = useConnectedStandardWallets();
  const { signAndSendTransaction } = useStandardSignAndSendTransaction();
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function claimPayout(pool: {
    poolIdOnChain: string;
    poolConfigAddress: string;
    vaultAddress: string;
    tokenMint: string;
  }): Promise<{ claimed?: boolean; payoutAmount?: string }> {
    const wallet = wallets[0];
    if (!wallet || !user) throw new Error("Sign in first");

    setClaiming(true);
    setError(null);
    try {
      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      const userPubkey = new PublicKey(wallet.address);

      const tx = await buildClaimPayoutTransaction(connection, {
        user: userPubkey,
        poolConfig: new PublicKey(pool.poolConfigAddress),
        vault: new PublicKey(pool.vaultAddress),
        tokenMint: new PublicKey(pool.tokenMint),
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

      const res = await fetch(`/api/pools/${pool.poolIdOnChain}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privyId: user.id, txSig }),
      });
      const responseBody = await res.json();
      if (!res.ok) throw new Error(responseBody.error ?? "Could not confirm your claim");
      return responseBody;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      setError(message);
      throw err;
    } finally {
      setClaiming(false);
    }
  }

  return { claimPayout, claiming, error };
}
