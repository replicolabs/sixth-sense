"use client";

import { usePrivy } from "@privy-io/react-auth";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { AppNav } from "@/components/AppNav";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton } from "@/components/ui/Buttons";
import { StreakFlame } from "@/components/ui/StreakFlame";

interface LeaderboardRow {
  rank: number;
  nickname: string;
  points: number;
  bestStreak: number;
  isMe: boolean;
  code: string;
}

const FRIENDS_STORAGE_KEY = "sixth-sense-friend-codes";

function loadStoredFriendCodes(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(FRIENDS_STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** CLAUDE.md Section 11.5: Global and Friends tabs, friends via a simple share code. */
export default function LeaderboardPage() {
  const { authenticated, login, user } = usePrivy();
  const [tab, setTab] = useState<"global" | "friends">("global");
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [friendCodes, setFriendCodes] = useState<string[]>([]);
  const [codeInput, setCodeInput] = useState("");

  useEffect(() => {
    setFriendCodes(loadStoredFriendCodes());
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (user?.id) params.set("privyId", user.id);
    if (tab === "friends") {
      params.set("scope", "friends");
      params.set("codes", friendCodes.join(","));
    }
    setRows(null);
    fetch(`/api/leaderboard?${params.toString()}`)
      .then((res) => res.json())
      .then((body) => setRows(body.rows));
  }, [tab, friendCodes, user?.id]);

  function addFriendCode() {
    const code = codeInput.trim();
    if (!code || friendCodes.includes(code)) return;
    const updated = [...friendCodes, code];
    setFriendCodes(updated);
    window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(updated));
    setCodeInput("");
  }

  function removeFriendCode(code: string) {
    const updated = friendCodes.filter((c) => c !== code);
    setFriendCodes(updated);
    window.localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(updated));
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 pb-16 pt-6 sm:px-6 lg:px-8">
      <AppNav />

      <div className="flex items-center gap-4">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--r-lg)] bg-[var(--pine-800)]">
          <Trophy className="h-7 w-7 text-[var(--gold-500)]" strokeWidth={1.75} />
        </div>
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--ink-900)]">
            Leaderboard
          </h1>
          <p className="text-sm text-[var(--ink-500)]">Every call, ranked. See where you stand.</p>
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-6 lg:items-start ${
          tab === "friends" ? "lg:grid-cols-[minmax(0,1fr)_320px]" : ""
        }`}
      >
        <div className="flex flex-col gap-4 lg:order-1">
          <div className="flex gap-2">
            <button
              onClick={() => setTab("global")}
              className={`flex-1 rounded-[var(--r-pill)] py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-6 ${
                tab === "global" ? "bg-[var(--volt-500)] text-[var(--ink-900)]" : "bg-[var(--cream-sunken)] text-[var(--ink-500)]"
              }`}
            >
              Global
            </button>
            <button
              onClick={() => setTab("friends")}
              className={`flex-1 rounded-[var(--r-pill)] py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-6 ${
                tab === "friends" ? "bg-[var(--volt-500)] text-[var(--ink-900)]" : "bg-[var(--cream-sunken)] text-[var(--ink-500)]"
              }`}
            >
              Friends
            </button>
          </div>

          {!authenticated && (
            <div className="glass-panel flex items-center justify-between gap-3 rounded-[var(--r-md)] px-4 py-2.5">
              <span className="text-sm text-[var(--ink-700)]">Sign in to see your rank.</span>
              <PrimaryButton onClick={login} className="px-4 py-1.5 text-sm">
                Sign in
              </PrimaryButton>
            </div>
          )}

          {rows === null && <p className="text-center text-sm text-[var(--ink-500)]">Loading…</p>}

          {rows?.length === 0 && (
            <GlassPanel radius="lg" className="flex flex-col items-center gap-2 px-6 py-12 text-center">
              <Trophy className="h-8 w-8 text-[var(--ink-400)]" strokeWidth={1.5} />
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
                {tab === "friends" ? "No friends added yet" : "No one on the board yet"}
              </p>
              <p className="max-w-sm text-sm text-[var(--ink-500)]">
                {tab === "friends"
                  ? "Paste a friend's code to see them here."
                  : "Play a match and be the first name on this board."}
              </p>
              {tab === "global" && (
                <Link href="/play" className="mt-2">
                  <PrimaryButton className="px-5 py-2 text-sm">Play now</PrimaryButton>
                </Link>
              )}
            </GlassPanel>
          )}

          {rows && rows.length > 0 && (
            <ol className="grid grid-cols-1 gap-1.5 lg:grid-cols-2">
              {rows.map((row) => (
                <li
                  key={row.code}
                  className={`flex items-center justify-between rounded-[var(--r-md)] px-4 py-3 ${
                    row.isMe ? "bg-[var(--volt-500)]/20" : "bg-[var(--cream-sunken)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 text-center font-[family-name:var(--font-mono)] text-sm text-[var(--ink-500)]">
                      {row.rank}
                    </span>
                    <span className={`text-sm ${row.isMe ? "font-semibold" : ""} text-[var(--ink-900)]`}>
                      {row.nickname}
                      {row.isMe ? " (you)" : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <StreakFlame streak={row.bestStreak} />
                    <span className="font-[family-name:var(--font-mono)] text-sm font-semibold text-[var(--ink-900)]">
                      {row.points}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        {tab === "friends" && (
          <GlassPanel radius="lg" className="p-4 lg:order-2">
            <p className="text-sm font-semibold text-[var(--ink-900)]">Add a friend's code</p>
            {authenticated && user && (
              <p className="mt-1 text-xs text-[var(--ink-500)]">
                Your code: <span className="font-[family-name:var(--font-mono)] font-semibold">{user.id}</span>
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addFriendCode()}
                placeholder="Paste a code"
                className="flex-1 rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-3 py-2 text-sm text-[var(--ink-900)]"
              />
              <PrimaryButton onClick={addFriendCode} className="px-4 py-2 text-sm">
                Add
              </PrimaryButton>
            </div>
            {friendCodes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {friendCodes.map((code) => (
                  <button
                    key={code}
                    onClick={() => removeFriendCode(code)}
                    className="rounded-[var(--r-pill)] bg-[var(--cream-sunken)] px-2 py-1 text-xs text-[var(--ink-500)]"
                    title="Remove"
                  >
                    {code} ×
                  </button>
                ))}
              </div>
            )}
          </GlassPanel>
        )}
      </div>
    </main>
  );
}
