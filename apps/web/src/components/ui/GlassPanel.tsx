import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Tailwind's compiler statically scans source for complete class name
// strings, it can't resolve a template-literal-interpolated class like
// `rounded-[var(--r-${radius})]`, so the radius options are spelled out in
// full here rather than built dynamically.
const RADIUS_CLASSES = {
  sm: "rounded-[var(--r-sm)]",
  md: "rounded-[var(--r-md)]",
  lg: "rounded-[var(--r-lg)]",
  xl: "rounded-[var(--r-xl)]",
} as const;

const VARIANT_CLASSES = {
  light: "glass-panel",
  dark: "glass-panel-dark",
  /** The single boldest floating element on a screen, the prediction card, a hero panel. Not for repeated use. */
  thick: "glass-panel-thick",
} as const;

/**
 * Section 10.3 glass panel recipe, as a reusable wrapper. Use for floating
 * elements (prediction card, HUD, toasts), keep list content on solid
 * cream so it stays readable and to cap how many backdrop-filter layers
 * are on screen at once (Section 10.3: "respect performance").
 */
export function GlassPanel({
  children,
  variant = "light",
  radius = "xl",
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANT_CLASSES;
  radius?: keyof typeof RADIUS_CLASSES;
  className?: string;
}) {
  return <div className={cn(VARIANT_CLASSES[variant], RADIUS_CLASSES[radius], className)}>{children}</div>;
}
