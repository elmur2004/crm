"use client";

import { useEffect, useRef, useState } from "react";
import { formatEGP } from "@/lib/money";

/* ============================================================================
   A dashboard number that COUNTS ON CHANGE, never on load (dashboard spec
   §5.3 — the BUG-026 fix, kept).

   The first render is the server's figure, exactly, and nothing animates on
   mount: no frame ever shows 0 or a half-way value on arrival. The value it
   last showed is kept in a ref; when the prop CHANGES (a range switch, a
   To-Do tick's refresh, the refresh on returning to the tab) it eases from
   what is on screen to the new figure over 600 ms, cubic-out.

   While it runs, the moving digits are aria-hidden and a visually hidden twin
   holds the FINAL value, so a screen reader never reads an in-between number.
   Under prefers-reduced-motion it simply swaps.

   It formats through `formatEGP` (the only money formatter) or plain Latin
   integer digits — no locale API of its own, so the ADR-068 date/time sweep
   has nothing to inventory here.
   ========================================================================== */

export type LiveFormat = "egp" | "int" | "pct";

const DURATION = 600;

function groupDigits(n: number): string {
  const s = String(Math.round(Math.abs(n)));
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return n < 0 ? `-${grouped}` : grouped;
}

export function formatLive(value: number, format: LiveFormat, settled: boolean): string {
  if (format === "egp") {
    /* mid-animation: whole pounds only, so the digits do not flicker through
       piasters; the settled value is exact */
    return formatEGP(settled ? value : Math.round(value / 100) * 100);
  }
  if (format === "pct") return `${Math.round(value)}%`;
  return groupDigits(value);
}

export function LiveNumber({ value, format = "int" }: { value: number; format?: LiveFormat }) {
  const [shown, setShown] = useState(value);
  /* the number currently ON SCREEN — a change that lands mid-animation starts
     from where the eye is, not from the previous target */
  const onScreen = useRef(value);
  const raf = useRef<number | null>(null);

  useEffect(() => {
    const from = onScreen.current;
    if (from === value) return;
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      onScreen.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = t < 1 ? from + (value - from) * eased : value;
      onScreen.current = current;
      setShown(current);
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    };
  }, [value]);

  const settled = shown === value;
  return (
    <>
      <span aria-hidden={settled ? undefined : true}>{formatLive(shown, format, settled)}</span>
      {settled ? null : <span className="sr-only">{formatLive(value, format, true)}</span>}
    </>
  );
}
