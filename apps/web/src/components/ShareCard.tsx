"use client";

import type { MatchState } from "@sixth-sense/shared";
import { useState } from "react";
import { SecondaryButton } from "@/components/ui/Buttons";
import type { SessionSummary } from "@/components/SessionSummaryPanel";

const WIDTH = 1080;
const HEIGHT = 1350;

async function ensureFontsLoaded() {
  try {
    await Promise.all([
      document.fonts.load("800 90px 'Bricolage Grotesque'"),
      document.fonts.load("600 32px 'Geist'"),
      document.fonts.load("600 40px 'Geist Mono'"),
    ]);
  } catch {
    // Canvas still renders with fallback system fonts if these don't load in time.
  }
}

/**
 * CLAUDE.md Section 11.6: "a generated share card (image) styled in the
 * brand system." Drawn client-side onto a canvas rather than round-
 * tripping to a server image-rendering pipeline — a real PNG comes out
 * either way, just without needing new server infrastructure.
 */
async function drawShareCard(summary: SessionSummary, matchState: MatchState | null): Promise<Blob> {
  await ensureFontsLoaded();

  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d")!;

  const styles = getComputedStyle(document.documentElement);
  const cream = styles.getPropertyValue("--cream").trim() || "#F6F2E9";
  const pine900 = styles.getPropertyValue("--pine-900").trim() || "#0A2A20";
  const pine700 = styles.getPropertyValue("--pine-700").trim() || "#144D3B";
  const volt500 = styles.getPropertyValue("--volt-500").trim() || "#C6F135";
  const gold500 = styles.getPropertyValue("--gold-500").trim() || "#F4B740";
  const ink900 = styles.getPropertyValue("--ink-900").trim() || "#12241C";
  const ink500 = styles.getPropertyValue("--ink-500").trim() || "#5E6E66";

  // Background: cream base + a pine radial glow, echoing the app's own mesh background.
  ctx.fillStyle = cream;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const glow = ctx.createRadialGradient(WIDTH * 0.85, HEIGHT * 0.05, 0, WIDTH * 0.85, HEIGHT * 0.05, WIDTH * 0.9);
  glow.addColorStop(0, `${pine700}55`);
  glow.addColorStop(1, `${pine700}00`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Wordmark.
  ctx.fillStyle = ink900;
  ctx.font = "800 56px 'Bricolage Grotesque', system-ui, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("Sixth Sense", 72, 140);
  ctx.fillStyle = volt500;
  ctx.beginPath();
  ctx.arc(360, 122, 10, 0, Math.PI * 2);
  ctx.fill();

  // Match line, if we have one.
  if (matchState) {
    ctx.fillStyle = ink500;
    ctx.font = "600 32px 'Geist', system-ui, sans-serif";
    ctx.fillText(`${matchState.fixtureInfo.participant1} vs ${matchState.fixtureInfo.participant2}`, 72, 210);
  }

  // Big headline number: points.
  ctx.fillStyle = pine900;
  ctx.font = "800 220px 'Bricolage Grotesque', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(String(summary.pointsTotal), WIDTH / 2, 560);
  ctx.fillStyle = ink500;
  ctx.font = "600 40px 'Geist', system-ui, sans-serif";
  ctx.fillText("POINTS THIS MATCH", WIDTH / 2, 630);

  // Stat row: best streak / calls won / accuracy.
  const stats: [string, string][] = [
    [String(summary.bestStreak), "BEST STREAK"],
    [`${summary.callsWon}/${summary.callsMade}`, "CALLS WON"],
    [`${Math.round(summary.accuracy * 100)}%`, "ACCURACY"],
  ];
  const colW = WIDTH / 3;
  stats.forEach(([value, label], i) => {
    const cx = colW * i + colW / 2;
    ctx.fillStyle = gold500;
    ctx.font = "700 72px 'Geist Mono', monospace";
    ctx.fillText(value, cx, 820);
    ctx.fillStyle = ink500;
    ctx.font = "600 26px 'Geist', system-ui, sans-serif";
    ctx.fillText(label, cx, 862);
  });

  // Provably fair note.
  if (summary.settlement.status === "proven") {
    ctx.fillStyle = pine700;
    ctx.font = "600 30px 'Geist', system-ui, sans-serif";
    ctx.fillText("● Provably fair — settled on-chain", WIDTH / 2, 960);
  }

  ctx.fillStyle = ink500;
  ctx.font = "500 28px 'Geist', system-ui, sans-serif";
  ctx.fillText("Call it before it happens.", WIDTH / 2, HEIGHT - 72);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob!), "image/png"));
}

export function ShareCardButton({
  summary,
  matchState,
}: {
  summary: SessionSummary;
  matchState: MatchState | null;
}) {
  const [busy, setBusy] = useState(false);

  async function handleShare() {
    setBusy(true);
    try {
      const blob = await drawShareCard(summary, matchState);
      const file = new File([blob], "sixth-sense-result.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "Sixth Sense", text: "Call it before it happens." });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "sixth-sense-result.png";
        a.click();
        URL.revokeObjectURL(url);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SecondaryButton onClick={handleShare} disabled={busy} className="w-full">
      {busy ? "Preparing…" : "Share result"}
    </SecondaryButton>
  );
}
