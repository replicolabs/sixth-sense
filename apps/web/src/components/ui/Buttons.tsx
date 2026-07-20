"use client";

import { motion } from "framer-motion";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// framer-motion's gesture handlers (onDrag, onAnimationStart, ...) have
// different signatures than the native DOM event handlers of the same
// name, so spreading raw ButtonHTMLAttributes onto motion.button conflicts,
// omit the handful that actually collide.
type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
>;

/** Section 10.6/11.8: volt, pill, the primary CTA everywhere in the app. */
export function PrimaryButton({ className = "", children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={cn(
        // inline-flex + shrink-0 + nowrap: a button squeezed inside a tight
        // flex row (a card with a long sentence next to it, a narrow
        // sidebar) must never lose its pill shape or wrap its label onto
        // two lines, found by a real bug report: this exact button
        // collapsed into a near-circle with "Sign in" wrapped across two
        // lines once it landed in a narrower container than it was built
        // against.
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--r-pill)] bg-[var(--volt-500)] px-6 py-3 font-[family-name:var(--font-sans)] font-semibold text-[var(--ink-900)] shadow-[0_4px_16px_rgba(198,241,53,0.35)] transition-colors hover:bg-[var(--volt-400)] disabled:opacity-50 disabled:shadow-none",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}

/** Secondary action, quieter, concentric radius smaller than pill CTAs use. */
export function SecondaryButton({ className = "", children, ...props }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-[var(--r-md)] bg-[var(--cream-sunken)] px-5 py-2.5 font-[family-name:var(--font-sans)] font-medium text-[var(--ink-700)] transition-colors hover:bg-[var(--hairline)] disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  );
}
