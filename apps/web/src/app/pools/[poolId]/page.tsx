"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton } from "@/components/ui/Buttons";
import { useClaimPayout } from "@/hooks/useClaimPayout";
import { useJoinPool } from "@/hooks/useJoinPool";

const TOKEN_DECIMALS = 6; // see pools/page.tsx's note — USDC/USDT-shaped mints only.

interface PoolDetail {
  poolIdOnChain: string;
  poolConfigAddress: string;
  vaultAddress: string;
  tokenMint: string;
  gameweekLabel: string;
  status: "open" | "locked" | "settled" | "cancelled";
  weekStart: string;
  weekEnd: string;
  minStake: string;
  rakeBps: number;
  paidPercentBps: number;
  minParticipants: number;
  participantCount: number;
  totalStaked: string;
}

interface EntryRow {
  nickname: string;
  isMe: boolean;
  amountStaked: string;
  poolPoints: string;
  rank: number | null;
  payoutAmount: string | null;
  claimed: boolean;
}

function dollars(raw: string): string {
  return (Number(BigInt(raw)) / 10 ** TOKEN_DECIMALS).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function PoolDetailPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { authenticated, login, user } = usePrivy();
  const { joinPool, joining, error: joinError } = useJoinPool();
  const { claimPayout, claiming, error: claimError } = useClaimPayout();

  const [pool, setPool] = useState<PoolDetail | null>(null);
  const [entries, setEntries] = useState<EntryRow[] | null>(null);
  const [amountInput, setAmountInput] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("privyId", user.id);
    fetch(`/api/pools/${poolId}?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => {
        setPool(body.pool);
        setEntries(body.entries);
        if (body.pool && !amountInput) {
          setAmountInput(dollars(body.pool.minStake));
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolId, user?.id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const myEntry = entries?.find((e) => e.isMe) ?? null;

  async function handleJoin() {
    if (!pool) return;
    setStatus(null);
    const amount = BigInt(Math.round(Number(amountInput) * 10 ** TOKEN_DECIMALS));
    try {
      await joinPool({
        poolIdOnChain: pool.poolIdOnChain,
        poolConfigAddress: pool.poolConfigAddress,
        vaultAddress: pool.vaultAddress,
        tokenMint: pool.tokenMint,
        amount,
      });
      setStatus("You're in. Good luck.");
      refresh();
    } catch {
      // joinError already holds the message; nothing else to do here.
    }
  }

  async function handleClaim() {
    if (!pool) return;
    setStatus(null);
    try {
      const result = await claimPayout({
        poolIdOnChain: pool.poolIdOnChain,
        poolConfigAddress: pool.poolConfigAddress,
        vaultAddress: pool.vaultAddress,
        tokenMint: pool.tokenMint,
      });
      setStatus(`Claimed $${dollars(result.payoutAmount ?? "0")}.`);
      refresh();
    } catch {
      // claimError already holds the message.
    }
  }

  if (!pool) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-10 pt-6">
        <p className="text-center text-sm text-[var(--ink-500)]">Loading pool…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 px-4 pb-10 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--ink-900)]">
          Pools
        </span>
        <Link href="/pools" className="text-sm font-medium text-[var(--pine-700)]">
          All pools
        </Link>
      </header>

      <GlassPanel radius="lg" className="p-4">
        <p className="font-[family-name:var(--font-display)] text-xl font-bold text-[var(--ink-900)]">
          {pool.gameweekLabel}
        </p>
        <p className="mt-1 text-sm text-[var(--ink-500)]">
          Locks {new Date(pool.weekStart).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center font-[family-name:var(--font-mono)]">
          <div>
            <p className="text-lg font-semibold text-[var(--ink-900)]">${dollars(pool.totalStaked)}</p>
            <p className="text-xs text-[var(--ink-500)]">Pot</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--ink-900)]">{pool.participantCount}</p>
            <p className="text-xs text-[var(--ink-500)]">Staked</p>
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--ink-900)]">{pool.paidPercentBps / 100}%</p>
            <p className="text-xs text-[var(--ink-500)]">Get paid</p>
          </div>
        </div>
      </GlassPanel>

      {!authenticated && (
        <div className="glass-panel flex items-center justify-between rounded-[var(--r-md)] px-4 py-2.5">
          <span className="text-sm text-[var(--ink-700)]">Sign in to stake.</span>
          <PrimaryButton onClick={login} className="px-4 py-1.5 text-sm">
            Sign in
          </PrimaryButton>
        </div>
      )}

      {authenticated && pool.status === "open" && !myEntry && (
        <GlassPanel radius="lg" className="p-4">
          <p className="text-sm font-semibold text-[var(--ink-900)]">Pick your stake</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg text-[var(--ink-500)]">$</span>
            <input
              type="number"
              min={dollars(pool.minStake)}
              step="0.01"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              className="flex-1 rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-3 py-2 font-[family-name:var(--font-mono)] text-[var(--ink-900)]"
            />
          </div>
          <p className="mt-1 text-xs text-[var(--ink-400)]">Minimum ${dollars(pool.minStake)}</p>
          <PrimaryButton onClick={handleJoin} disabled={joining} className="mt-3 w-full">
            {joining ? "Staking…" : "Join pool"}
          </PrimaryButton>
          {joinError && <p className="mt-2 text-sm text-[var(--loss)]">{joinError}</p>}
        </GlassPanel>
      )}

      {authenticated && pool.status === "open" && myEntry && (
        <GlassPanel radius="lg" className="p-4 text-center">
          <p className="text-sm font-semibold text-[var(--win)]">
            You&apos;re in for ${dollars(myEntry.amountStaked)}.
          </p>
          <p className="mt-1 text-xs text-[var(--ink-500)]">Play the free game as usual — this pool scores it.</p>
        </GlassPanel>
      )}

      {pool.status === "locked" && (
        <GlassPanel radius="lg" className="p-4 text-center">
          <p className="text-sm text-[var(--ink-700)]">This gameweek is live. Standings update as calls settle.</p>
        </GlassPanel>
      )}

      {(pool.status === "settled" || pool.status === "cancelled") && myEntry && (
        <GlassPanel radius="lg" className="p-4">
          {pool.status === "cancelled" ? (
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              This pool didn&apos;t reach the minimum {pool.minParticipants} stakers — everyone gets a full refund.
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--ink-900)]">
              You finished {myEntry.rank ? `#${myEntry.rank}` : "unranked"}.
            </p>
          )}
          <p className="mt-1 text-2xl font-[family-name:var(--font-mono)] font-bold text-[var(--win)]">
            ${dollars(myEntry.payoutAmount ?? "0")}
          </p>
          {!myEntry.claimed ? (
            <PrimaryButton onClick={handleClaim} disabled={claiming} className="mt-3 w-full">
              {claiming ? "Claiming…" : "Claim"}
            </PrimaryButton>
          ) : (
            <p className="mt-3 text-center text-sm text-[var(--ink-500)]">Claimed.</p>
          )}
          {claimError && <p className="mt-2 text-sm text-[var(--loss)]">{claimError}</p>}
        </GlassPanel>
      )}

      {status && <p className="text-center text-sm text-[var(--win)]">{status}</p>}

      {entries && entries.length > 0 && (pool.status === "locked" || pool.status === "settled") && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">Standings</p>
          <ol className="flex flex-col gap-1.5">
            {entries.map((entry, i) => (
              <li
                key={i}
                className={`flex items-center justify-between rounded-[var(--r-sm)] px-3 py-2 text-sm ${
                  entry.isMe ? "bg-[var(--volt-500)]/20 font-semibold" : "bg-[var(--cream-sunken)]"
                }`}
              >
                <span>
                  {entry.rank ? `#${entry.rank}` : i + 1} {entry.nickname}
                </span>
                <span className="font-[family-name:var(--font-mono)]">{entry.poolPoints} pts</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
