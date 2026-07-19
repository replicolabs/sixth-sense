"use client";

import { animate } from "framer-motion";
import { useEffect, useRef, useState } from "react";

/**
 * Section 10.5: "the points number counts up in Geist Mono with an
 * odometer feel." Animates from the previous value to the new one instead
 * of snapping, and respects prefers-reduced-motion by jumping instantly.
 */
export function PointsCounter({ value, className = "" }: { value: number; className?: string }) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setDisplay(value);
      prevValue.current = value;
      return;
    }
    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  return (
    <span className={`font-[family-name:var(--font-mono)] tabular-nums ${className}`}>{display}</span>
  );
}
