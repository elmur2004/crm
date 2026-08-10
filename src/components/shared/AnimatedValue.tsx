"use client";

import { useEffect, useRef, useState } from "react";

/* Count-up for dashboard numbers: server renders the final string (no layout
   shift), then the number animates 0 → value on mount. Non-numeric parts
   ("EGP ", "%") are preserved. Respects prefers-reduced-motion. */

const NUM_RE = /([\d,]+(?:\.\d+)?)/;

export function AnimatedValue({ value, duration = 700 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const match = value.match(NUM_RE);
    if (!match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const target = Number(match[1]!.replace(/,/g, ""));
    if (!Number.isFinite(target) || target === 0) {
      setDisplay(value);
      return;
    }
    const decimals = match[1]!.includes(".") ? match[1]!.split(".")[1]!.length : 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = (target * eased).toLocaleString("en-EG", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
      setDisplay(value.replace(NUM_RE, current));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <>{display}</>;
}
