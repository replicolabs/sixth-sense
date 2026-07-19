/**
 * Section 10.5/11.2: "LIVE" as a solid text pill, deliberately NO pulsing
 * dot — liveness is meant to read through the ticking clock and ambient
 * breathing glow instead (Section 10.5).
 */
export function LiveTag() {
  return (
    <span className="rounded-[var(--r-pill)] bg-[var(--volt-500)] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[var(--ink-900)]">
      Live
    </span>
  );
}
