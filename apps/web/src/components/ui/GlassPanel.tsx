import type { ReactNode } from "react";

// Tailwind's compiler statically scans source for complete class name
// strings — it can't resolve a template-literal-interpolated class like
// `rounded-[var(--r-${radius})]`, so the radius options are spelled out in
// full here rather than built dynamically.
const RADIUS_CLASSES = {
  sm: "rounded-[var(--r-sm)]",
  md: "rounded-[var(--r-md)]",
  lg: "rounded-[var(--r-lg)]",
  xl: "rounded-[var(--r-xl)]",
} as const;

/**
 * Section 10.3 glass panel recipe, as a reusable wrapper. Use for floating
 * elements (prediction card, HUD, toasts) — keep list content on solid
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
  variant?: "light" | "dark";
  radius?: keyof typeof RADIUS_CLASSES;
  className?: string;
}) {
  return (
    <div
      className={`${variant === "dark" ? "glass-panel-dark" : "glass-panel"} ${RADIUS_CLASSES[radius]} ${className}`}
    >
      {children}
    </div>
  );
}
