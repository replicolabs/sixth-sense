"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";

interface PoolRow {
  poolIdOnChain: string;
  gameweekLabel: string;
  status: "open" | "locked" | "settled" | "cancelled";
  weekStart: string;
  weekEnd: string;
  minStake: string;
  rakeBps: number;
  paidPercentBps: number;
  participantCount: number;
  totalStaked: string;
  tokenMint: string;
}

// EXPANSION.md Section 4: the staking currency is USDC/USDT-shaped, both
// 6-decimal tokens — assumed here rather than looked up per-mint on chain,
// since this build only ever points pools at one such mint at a time.
const TOKEN_DECIMALS = 6;

function formatTokenAmount(raw: string): string {
  const value = Number(BigInt(raw)) / 10 ** TOKEN_DECIMALS;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status: PoolRow["status"]): string {
  switch (status) {
    case "open":
      return "Open — join now";
    case "locked":
      return "Live";
    case "settled":
      return "Settled";
    case "cancelled":
      return "Refunded";
  }
}

export default function PoolsPage() {
  const [pools, setPools] = useState<PoolRow[] | null>(null);

  useEffect(() => {
    fetch("/api/pools")
      .then((res) => res.json())
      .then((body) => setPools(body.pools));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
          Pools
        </span>
        <Link href="/play" className="text-sm font-medium text-[var(--pine-700)]">
          Back to live
        </Link>
      </header>

      <p className="text-sm text-[var(--ink-500)]">
        Stake on a week of real matches. Everyone plays the same free game — the pool just decides
        what your score is worth.
      </p>

      {pools === null && <p className="text-center text-sm text-[var(--ink-500)]">Loading pools…</p>}
      {pools?.length === 0 && (
        <p className="text-center text-sm text-[var(--ink-500)]">No pools open right now. Check back soon.</p>
      )}

      <div className="flex flex-col gap-3">
        {pools?.map((pool) => (
          <Link key={pool.poolIdOnChain} href={`/pools/${pool.poolIdOnChain}`}>
            <GlassPanel radius="lg" className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">
                  {statusLabel(pool.status)}
                </span>
                <span className="text-xs text-[var(--ink-400)]">
                  Min ${formatTokenAmount(pool.minStake)}
                </span>
              </div>
              <p className="mt-1 font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
                {pool.gameweekLabel}
              </p>
              <div className="mt-2 flex items-center justify-between font-[family-name:var(--font-mono)] text-sm text-[var(--ink-700)]">
                <span>{pool.participantCount} staked</span>
                <span>${formatTokenAmount(pool.totalStaked)} pot</span>
              </div>
            </GlassPanel>
          </Link>
        ))}
      </div>
    </main>
  );
}
