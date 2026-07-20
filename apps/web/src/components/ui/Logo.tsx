import Link from "next/link";

/**
 * The Sixth Sense mark. A football rendered as a radar sweep, since the
 * product's whole idea is reading the pitch a beat before something
 * happens. Built as inline SVG so it never needs an external asset and
 * always matches the current text color (works on cream and on dark
 * glass without a separate light/dark file).
 */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14.5" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      <path
        d="M16 16 L16 3.5 A12.5 12.5 0 0 1 27.3 21.5 Z"
        fill="var(--volt-500)"
        opacity="0.9"
      />
      <circle cx="16" cy="16" r="3.4" fill="currentColor" />
      <path
        d="M16 16 L21.5 8.2 M16 16 L24.5 16.6 M16 16 L20 24.4"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        opacity="0.55"
      />
    </svg>
  );
}

export function Logo({
  href = "/",
  iconSize = 26,
  showText = true,
  className = "",
}: {
  href?: string;
  iconSize?: number;
  /** Interior app screens show the mark alone. Only the landing page keeps the wordmark. */
  showText?: boolean;
  className?: string;
}) {
  return (
    // No hardcoded text color here on purpose: this mark is used on both
    // the cream home screens (wants ink-900) and the dark landing hero
    // (wants cream). A color set here would win over any ancestor's
    // color via inheritance rules regardless of what wraps it, so the
    // caller's own text color is what applies instead.
    <Link href={href} className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={iconSize} />
      {showText && (
        <span className="font-[family-name:var(--font-display)] text-lg font-bold">Sixth Sense</span>
      )}
    </Link>
  );
}
