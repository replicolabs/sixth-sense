"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SKIN_TONES, HAIR_STYLES, HAIR_COLORS, FACIAL_HAIR_STYLES, PRESENTATION_OPTIONS } from "@sixth-sense/shared";
import { AvatarBuilderForm, type AvatarBuilderValue } from "@/components/AvatarBuilderForm";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";

const DEFAULT_AVATAR: AvatarBuilderValue = {
  skinTone: SKIN_TONES[4].id,
  hairStyle: HAIR_STYLES[2].id,
  hairColor: HAIR_COLORS[0].id,
  facialHair: FACIAL_HAIR_STYLES[0].id,
  presentation: PRESENTATION_OPTIONS[2].id,
  nationalityCode: "US",
};

const EXPLAINER_CARDS = [
  {
    title: "Watch the match",
    body: "Every match plays out live, right there on your screen. Real teams, real moments, no waiting around.",
  },
  {
    title: "Call the next moment",
    body: "Every 30 to 90 seconds we'll ask you to call it: a goal, a corner, a card. Just tap yes or no.",
  },
  {
    title: "Build your streak",
    body: "Get it right and your streak grows. Miss one and it resets to zero, so every call matters.",
  },
];

type Step = "name" | "look" | "explainer";

const STEP_ORDER: Step[] = ["name", "look", "explainer"];

/**
 * CLAUDE.md Section 11.1: "One-tap sign in... The user only sees 'Enter
 * your name' and 'Pick your look'... A 3-card explainer of the loop...
 * Skippable... End on a big volt CTA: 'Start playing.'" Reached via
 * useSyncUser's redirect the moment a signed-in user's hasOnboarded is
 * still false — never a page someone has to navigate to on purpose.
 */
export default function OnboardingPage() {
  const { authenticated, login, user } = usePrivy();
  const router = useRouter();
  const [step, setStep] = useState<Step>("name");
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<AvatarBuilderValue>(DEFAULT_AVATAR);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stepIndex = STEP_ORDER.indexOf(step);
  const trimmedNickname = nickname.trim();

  async function handleContinueFromLook() {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const [nameRes, avatarRes] = await Promise.all([
        fetch("/api/onboarding/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privyId: user.id, nickname: trimmedNickname }),
        }),
        fetch("/api/avatar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privyId: user.id, ...avatar }),
        }),
      ]);
      if (!nameRes.ok || !avatarRes.ok) throw new Error("save failed");
      setStep("explainer");
    } catch {
      setError("Couldn't save that. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-4 pb-10 pt-8">
      <div className="flex items-center justify-center gap-1.5">
        {STEP_ORDER.map((s, i) => (
          <span
            key={s}
            className={`h-1.5 rounded-[var(--r-pill)] transition-all ${
              i === stepIndex ? "w-6 bg-[var(--pine-700)]" : "w-1.5 bg-[var(--hairline)]"
            }`}
          />
        ))}
      </div>

      {!authenticated ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)]">
            Let's get you set up.
          </p>
          <PrimaryButton onClick={login}>Sign in</PrimaryButton>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {step === "name" && (
            <motion.div
              key="name"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex flex-1 flex-col gap-5 pt-8"
            >
              <div className="text-center">
                <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--ink-900)]">
                  Enter your name
                </h1>
                <p className="mt-2 text-sm text-[var(--ink-500)]">
                  This is what shows up on the leaderboard and your calls.
                </p>
              </div>
              <input
                autoFocus
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Your name"
                maxLength={24}
                className="rounded-[var(--r-md)] border border-[var(--hairline)] bg-[var(--cream-elevated)] px-4 py-3 text-center text-lg font-medium text-[var(--ink-900)] outline-none focus:border-[var(--pine-500)]"
              />
              <PrimaryButton
                disabled={trimmedNickname.length < 2}
                onClick={() => setStep("look")}
                className="mt-2"
              >
                Continue
              </PrimaryButton>
            </motion.div>
          )}

          {step === "look" && (
            <motion.div
              key="look"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex flex-col gap-5"
            >
              <div className="text-center">
                <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold text-[var(--ink-900)]">
                  Pick your look
                </h1>
                <p className="mt-2 text-sm text-[var(--ink-500)]">
                  Your nationality unlocks your national kit right away.
                </p>
              </div>
              <AvatarBuilderForm value={avatar} onChange={setAvatar} />
              {error && <p className="text-center text-sm font-medium text-[var(--loss)]">{error}</p>}
              <PrimaryButton disabled={saving} onClick={handleContinueFromLook} className="mt-2">
                {saving ? "Saving…" : "Continue"}
              </PrimaryButton>
            </motion.div>
          )}

          {step === "explainer" && (
            <motion.div
              key="explainer"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex flex-1 flex-col gap-5 pt-4"
            >
              <div className="flex items-center justify-between">
                <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[var(--ink-900)]">
                  How it works
                </h1>
                <button
                  onClick={() => router.replace("/")}
                  className="text-sm font-medium text-[var(--ink-500)]"
                >
                  Skip
                </button>
              </div>

              <motion.div
                initial="hidden"
                animate="visible"
                variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
                className="flex flex-col gap-3"
              >
                {EXPLAINER_CARDS.map((card) => (
                  <motion.div
                    key={card.title}
                    variants={{
                      hidden: { opacity: 0, y: 12 },
                      visible: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 24 } },
                    }}
                  >
                    <GlassPanel radius="lg" className="p-4">
                      <p className="font-[family-name:var(--font-display)] text-base font-semibold text-[var(--ink-900)]">
                        {card.title}
                      </p>
                      <p className="mt-1 text-sm text-[var(--ink-500)]">{card.body}</p>
                    </GlassPanel>
                  </motion.div>
                ))}
              </motion.div>

              <PrimaryButton onClick={() => router.replace("/")} className="mt-2">
                Start playing
              </PrimaryButton>
              <SecondaryButton onClick={() => setStep("look")} className="w-full">
                Back
              </SecondaryButton>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </main>
  );
}
