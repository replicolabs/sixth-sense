"use client";

interface SwatchOption {
  id: string;
  label: string;
  color: string;
}

interface LabelOption {
  id: string;
  label: string;
}

/** A horizontally-scrollable ("swipeable" on touch) row of color swatches. */
export function SwatchOptionRow({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: SwatchOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">{title}</p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-label={option.label}
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`h-11 w-11 shrink-0 rounded-full border-2 transition-transform ${
              value === option.id
                ? "scale-110 border-[var(--volt-500)]"
                : "border-[var(--hairline)] hover:scale-105"
            }`}
            style={{ backgroundColor: option.color }}
          />
        ))}
      </div>
    </div>
  );
}

/** A horizontally-scrollable row of labeled pill buttons. */
export function LabelOptionRow({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: LabelOption[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--ink-500)]">{title}</p>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={value === option.id}
            onClick={() => onChange(option.id)}
            className={`shrink-0 whitespace-nowrap rounded-[var(--r-pill)] px-4 py-2 text-sm font-medium transition-colors ${
              value === option.id
                ? "bg-[var(--volt-500)] text-[var(--ink-900)]"
                : "bg-[var(--cream-sunken)] text-[var(--ink-700)] hover:bg-[var(--hairline)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
