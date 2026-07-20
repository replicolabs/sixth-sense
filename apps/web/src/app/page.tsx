"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Logo } from "@/components/ui/Logo";
import { PrimaryButton, SecondaryButton } from "@/components/ui/Buttons";

const LOOP_STEPS = [
  {
    title: "Watch the match",
    body: "Every match plays out live, right on your screen.",
    image: "/images/dembele.jpg",
    imageAlt: "A player holding a match ball",
  },
  {
    title: "Call the moment",
    body: "We ask if something is about to happen. You say yes or no.",
    image: "/images/ronaldo.png",
    imageAlt: "A player celebrating a goal",
  },
  {
    title: "Build your streak",
    body: "Get it right and your streak grows. Miss one and you start over.",
    image: null,
    imageAlt: "",
  },
];

const revealVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 220, damping: 26 } },
};

/**
 * The landing page. Rebuilt around seven real photographs of real
 * football moments rather than a wall of positioning copy, per the
 * product's explicit direction: lead with the imagery and the feeling.
 * Signed-in, onboarded users are routed straight to /home, this page's
 * only job is to make someone who has never heard of Sixth Sense want to
 * play. Sign-in lives here and nowhere else in the app.
 */
export default function LandingPage() {
  const { authenticated, login, ready, user } = usePrivy();
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!ready || !authenticated || !user) return;
    fetch(`/api/users/me?privyId=${encodeURIComponent(user.id)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { hasOnboarded?: boolean } | null) => {
        if (body?.hasOnboarded) router.replace("/home");
      })
      .catch(() => {});
  }, [ready, authenticated, user, router]);

  return (
    <main className="flex flex-col">
      {/* Hero: full-bleed, Mbappe alone on a dark pitch, arms wide. The single most cinematic asset in the set, so it carries the whole opening beat. */}
      <section className="relative flex min-h-[100dvh] w-full flex-col justify-end overflow-hidden bg-[var(--pine-900)]">
        <Image
          src="/images/mbappe.png"
          alt="Mbappe celebrating alone on the pitch, arms spread wide"
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_18%]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pine-900)] via-[var(--pine-900)]/35 to-transparent" />

        <div className="absolute left-0 right-0 top-0 flex items-center justify-between px-4 pt-6 sm:px-8 lg:px-12">
          <Logo href="/" iconSize={24} className="text-[var(--cream)]" />
          {!authenticated && (
            <button
              onClick={login}
              className="rounded-[var(--r-pill)] border border-white/25 px-4 py-1.5 text-sm font-medium text-[var(--cream)] backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Sign in
            </button>
          )}
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.15 }}
          className="relative flex flex-col gap-4 px-4 pb-14 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24"
        >
          <h1 className="max-w-2xl font-[family-name:var(--font-display)] text-4xl font-extrabold leading-[1.05] text-[var(--cream)] sm:text-6xl lg:text-7xl">
            Call it before it happens.
          </h1>
          <p className="max-w-md text-base text-[var(--cream)]/80 sm:text-lg">
            A question lands every thirty seconds. Get it right, build a streak. Get it wrong, you&apos;re
            back in seconds.
          </p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <PrimaryButton onClick={authenticated ? () => router.push("/home") : login} className="sm:w-auto">
              Start playing
            </PrimaryButton>
            <Link href="/classics">
              <SecondaryButton className="w-full border border-white/15 bg-white/10 text-[var(--cream)] hover:bg-white/15 sm:w-auto">
                Browse real matches
              </SecondaryButton>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* The feeling: a deliberate color drop to black and white. The one signature moment of the page. */}
      <section className="relative flex min-h-[75vh] w-full items-center justify-center overflow-hidden bg-black py-24 sm:min-h-[85vh]">
        <Image
          src="/images/fans-bw.jpg"
          alt="A crowd of fans erupting in celebration"
          fill
          sizes="100vw"
          className="object-cover opacity-70"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/20 to-black/70" />
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={revealVariants}
          className="relative mx-auto max-w-2xl px-6 text-center"
        >
          <p className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-white sm:text-5xl">
            You already know this feeling.
          </p>
          <p className="mx-auto mt-4 max-w-md text-white/75 sm:text-lg">
            That jolt right before it happens, the one that makes you shout before the ball even hits the
            net. That is the whole game.
          </p>
        </motion.div>
      </section>

      {/* How it works: back on solid cream, breaking the full-bleed pattern. */}
      <section className="bg-[var(--cream)] px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto max-w-5xl">
          <motion.h2
            initial={reduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.6 }}
            variants={revealVariants}
            className="text-center font-[family-name:var(--font-display)] text-3xl font-bold text-[var(--ink-900)] sm:text-4xl"
          >
            How it works
          </motion.h2>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
            {LOOP_STEPS.map((step, i) => (
              <motion.div
                key={step.title}
                initial={reduceMotion ? false : "hidden"}
                whileInView="visible"
                viewport={{ once: true, amount: 0.4 }}
                variants={revealVariants}
                transition={{ delay: reduceMotion ? 0 : i * 0.1 }}
                className="glass-panel flex flex-col overflow-hidden rounded-[var(--r-xl)]"
              >
                {step.image ? (
                  <div className="relative h-40 w-full">
                    <Image src={step.image} alt={step.imageAlt} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
                  </div>
                ) : (
                  <div className="flex h-40 w-full items-center justify-center bg-[var(--pine-800)]">
                    <span className="font-[family-name:var(--font-display)] text-5xl font-extrabold text-[var(--volt-500)]">
                      {i + 1}
                    </span>
                  </div>
                )}
                <div className="p-5">
                  <p className="font-[family-name:var(--font-display)] text-lg font-semibold text-[var(--ink-900)]">
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm text-[var(--ink-500)]">{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Celebration: the payoff feeling of a streak, Messi and Haaland carrying the energy asymmetrically. */}
      <section className="bg-[var(--pine-900)] px-4 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 lg:grid-cols-2">
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.5 }}
            variants={revealVariants}
            className="order-2 flex flex-col gap-4 lg:order-1"
          >
            <p className="font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[var(--cream)] sm:text-4xl">
              This is what a streak feels like.
            </p>
            <p className="max-w-md text-[var(--cream)]/70">
              Every correct call raises your multiplier. String enough of them together and one right
              answer starts paying like five. Break it, and you are chasing the feeling all over again.
            </p>
          </motion.div>
          <motion.div
            initial={reduceMotion ? false : "hidden"}
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={revealVariants}
            className="order-1 grid grid-cols-2 gap-3 lg:order-2"
          >
            <div className="relative col-span-2 h-56 overflow-hidden rounded-[var(--r-xl)] sm:h-72">
              <Image
                src="/images/messi.png"
                alt="Messi thrown into the air by teammates in celebration"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-top"
              />
            </div>
            <div className="relative col-span-2 h-48 overflow-hidden rounded-[var(--r-xl)] sm:h-56">
              <Image
                src="/images/haaland.png"
                alt="Haaland celebrating with teammates"
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover object-top"
              />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Closing CTA: asymmetric split, breaking from the celebration section's own composition. */}
      <section className="relative flex min-h-[70vh] w-full items-center overflow-hidden bg-[var(--ink-900)]">
        <div className="absolute inset-0">
          <Image
            src="/images/bellingham.jpg"
            alt="Bellingham celebrating intensely"
            fill
            sizes="100vw"
            className="object-cover object-[center_20%] opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[var(--ink-900)] via-[var(--ink-900)]/70 to-transparent" />
        </div>
        <motion.div
          initial={reduceMotion ? false : "hidden"}
          whileInView="visible"
          viewport={{ once: true, amount: 0.5 }}
          variants={revealVariants}
          className="relative flex flex-col gap-5 px-4 py-24 sm:px-8 sm:py-32 lg:px-12"
        >
          <p className="max-w-lg font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-[var(--cream)] sm:text-5xl">
            Your next call is thirty seconds away.
          </p>
          <PrimaryButton onClick={authenticated ? () => router.push("/home") : login} className="w-fit">
            Start playing
          </PrimaryButton>
        </motion.div>
      </section>

      <footer className="flex flex-col items-center gap-2 bg-[var(--cream)] px-4 py-10 text-center">
        <Logo iconSize={20} />
        <p className="text-xs text-[var(--ink-400)]">Every call settles against real match data. Provably fair, always.</p>
      </footer>
    </main>
  );
}
