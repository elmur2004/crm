"use client";

import { useEffect, useRef, useState } from "react";

/* Count-on-CHANGE for dashboard numbers (ADR-089). The server renders the real
   figure and that is what the first frame shows — there is no mount animation.
   When the value later changes (a refresh after an action), the number eases
   from what is on screen to the new figure. Non-numeric parts ("EGP ", "%")
   are preserved. Respects prefers-reduced-motion.

   It used to count up from 0 on every mount: the server's figure painted, the
   first animation frame then replaced it with "0" and climbed back over 700 ms
   — on every visit, and on a real change it restarted from 0 rather than from
   the old figure. */

const NUM_RE = /([\d,]+(?:\.\d+)?)/;

function numberIn(value: string): { n: number; decimals: number } | null {
  const match = value.match(NUM_RE);
  if (!match) return null;
  const n = Number(match[1]!.replace(/,/g, ""));
  if (!Number.isFinite(n)) return null;
  const decimals = match[1]!.includes(".") ? match[1]!.split(".")[1]!.length : 0;
  return { n, decimals };
}

export function AnimatedValue({ value, duration = 600 }: { value: string; duration?: number }) {
  const [display, setDisplay] = useState(value);
  /* the number currently ON SCREEN — a change that lands mid-animation starts
     from where the eye is, not from the previous target */
  const shown = useRef<number | null>(numberIn(value)?.n ?? null);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const target = numberIn(value);
    const from = shown.current;
    if (
      !target ||
      from === null ||
      from === target.n ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      shown.current = target?.n ?? null;
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const current = from + (target.n - from) * eased;
      shown.current = current;
      const text = current.toLocaleString("en-EG", {
        minimumFractionDigits: target.decimals,
        maximumFractionDigits: target.decimals,
      });
      setDisplay(t < 1 ? value.replace(NUM_RE, text) : value);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else shown.current = target.n;
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);

  return <>{display}</>;
}
