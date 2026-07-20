"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Coins } from "lucide-react";
import { AppNav } from "@/components/AppNav";
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
// 6-decimal tokens, assumed here rather than looked up per-mint on chain,
// since this build only ever points pools at one such mint at a time.
const TOKEN_DECIMALS = 6;

function formatTokenAmount(raw: string): string {
  const value = Number(BigInt(raw)) / 10 ** TOKEN_DECIMALS;
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusLabel(status: PoolRow["status"]): string {
  switch (status) {
    case "open":
      return "Open, join now";
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
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <AppNav />

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--r-lg)] bg-[var(--pine-800)]">
          <Coins className="h-7 w-7 text-[var(--gold-500)]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--ink-900)]">
            Pools
          </h1>
          <p className="text-sm text-[var(--ink-500)]">
            Stake on a week of real matches. Everyone plays the same free game, the pool just decides what
            your score is worth.
          </p>
        </div>
      </div>

      {pools === null && <p className="text-center text-sm text-[var(--ink-500)]">Loading pools…</p>}
      {pools?.length === 0 && (
        <GlassPanel radius="lg" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
          <Coins className="h-8 w-8 text-[var(--ink-400)]" strokeWidth={1.5} />
          <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
            No pools open right now
          </p>
          <p className="max-w-sm text-sm text-[var(--ink-500)]">
            New gameweeks open regularly. Check back soon, or play a free match while you wait.
          </p>
        </GlassPanel>
      )}

      {pools && pools.length > 0 && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {pools?.map((pool) => (
          <Link key={pool.poolIdOnChain} href={`/pools/${pool.poolIdOnChain}`}>
            <GlassPanel radius="lg" className="p-4 transition-transform hover:-translate-y-0.5">
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
      )}
    </main>
  );
}
