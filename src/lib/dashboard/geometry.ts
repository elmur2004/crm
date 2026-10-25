/* ============================================================================
   Chart GEOMETRY for the Home — pure numbers, no React, no DOM.

   The charts are hand-rolled server-rendered HTML + SVG (no chart library:
   the cheapest one would add ~70 KB gzipped to the shell and none of them
   render without JavaScript). Seven forms — bar, ranked bar, centred funnel,
   line with gaps, sparkline, semicircle meter, progress ring — are rectangles,
   one path and two arcs. Their arithmetic lives here so it can be unit-tested
   in this repo's Node-only Vitest, and the components stay thin.

   Two rules every function keeps:
   · an empty series (all zeros, a zero maximum) yields zero sizes, never NaN —
     zero is a real answer on a dashboard, and a NaN width paints nothing at
     all or, worse, a full bar;
   · direction is an argument. Category charts follow the document direction
     through CSS logical properties; the TIME axis is not mirrored in Arabic
     (charts and graphs are among Material's "not mirrored" items), but the
     choice is one flag here, not a rewrite (D11b).
   ========================================================================== */

export type Dir = "ltr" | "rtl";

/** A linear scale [0, domainMax] → [0, rangeLen]. A max of 0 maps everything to 0. */
export function scaleLinear(domainMax: number, rangeLen: number): (v: number) => number {
  if (!(domainMax > 0) || !Number.isFinite(domainMax)) return () => 0;
  return (v: number) => {
    const x = (Math.max(0, Math.min(v, domainMax)) / domainMax) * rangeLen;
    return Number.isFinite(x) ? x : 0;
  };
}

/** The smallest 1-2-5 step ≥ maxValue (gridline tops). 0 or less → 1. */
export function niceMax(maxValue: number): number {
  if (!(maxValue > 0) || !Number.isFinite(maxValue)) return 1;
  const exp = Math.floor(Math.log10(maxValue));
  const base = Math.pow(10, exp);
  for (const step of [1, 2, 5, 10]) {
    if (step * base >= maxValue) return step * base;
  }
  return 10 * base;
}

/** Bar sizes as fractions 0..1 of the largest value. All-zero → all 0. */
export function barLayout(values: number[]): { size: number }[] {
  const max = Math.max(0, ...values);
  return values.map((v) => ({ size: max > 0 ? Math.max(0, v) / max : 0 }));
}

export interface FunnelStepLayout {
  /** width as a percentage of the first step (the cohort) */
  widthPct: number;
  /** count ÷ first step, whole percent */
  pctOfFirst: number;
  /** count ÷ previous step, whole percent; null for the first step or a 0 previous */
  pctOfPrev: number | null;
}

export function funnelLayout(counts: number[]): FunnelStepLayout[] {
  const first = counts[0] ?? 0;
  return counts.map((c, i) => {
    const prev = i > 0 ? counts[i - 1]! : null;
    return {
      widthPct: first > 0 ? (c / first) * 100 : 0,
      pctOfFirst: first > 0 ? Math.round((c / first) * 100) : 0,
      pctOfPrev: prev === null || prev <= 0 ? null : Math.round((c / prev) * 100),
    };
  });
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A polyline through `points` (each a fraction 0..1 of the height, or null
    for a GAP). A gap breaks the path — the next point starts a new `M` — so a
    month with nothing decided is never drawn as 0%. `xs` are the x positions
    of every slot (null or not), for points and hit targets. */
export function linePath(
  points: (number | null)[],
  w: number,
  h: number,
  opts: { dir?: Dir } = {},
): { d: string; xs: number[]; ys: (number | null)[] } {
  const n = points.length;
  const xs = points.map((_, i) => {
    const x = n > 1 ? (i * w) / (n - 1) : w / 2;
    return r2(opts.dir === "rtl" ? w - x : x);
  });
  const ys = points.map((p) =>
    p === null || !Number.isFinite(p) ? null : r2(h - Math.max(0, Math.min(1, p)) * h),
  );
  let d = "";
  let pen = false;
  for (let i = 0; i < n; i++) {
    const y = ys[i];
    if (y === null || y === undefined) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${xs[i]} ${y} `;
    pen = true;
  }
  return { d: d.trim(), xs, ys };
}

/** Normalise a series to 0..1 of its own maximum (a sparkline's shape). */
export function normalise(values: number[]): number[] {
  const max = Math.max(0, ...values);
  return values.map((v) => (max > 0 ? Math.max(0, v) / max : 0));
}

/** The semicircle meter's arc, centre (r, r), radius r, over the TOP.
    LTR fills from the left end; RTL from the right end — the house meters
    fill from the inline START (`[dir="rtl"] .meter-fill`), and so does this.
    Fraction 0 is an empty string (nothing to stroke). */
export function arcPath(fraction: number, r: number, opts: { dir?: Dir } = {}): string {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  if (f === 0 || !(r > 0)) return "";
  const rtl = opts.dir === "rtl";
  const theta = Math.PI * f;
  /* LTR: start at (0, r), end at (r − r·cos θ, r − r·sin θ); RTL is the mirror
     image x → 2r − x, which also flips the sweep direction */
  const startX = rtl ? 2 * r : 0;
  const endX = rtl ? r + r * Math.cos(theta) : r - r * Math.cos(theta);
  const endY = r - r * Math.sin(theta);
  return `M${r2(startX)} ${r2(r)} A${r2(r)} ${r2(r)} 0 0 ${rtl ? 0 : 1} ${r2(endX)} ${r2(endY)}`;
}

/** A progress ring's dash: circumference and the offset that leaves
    `fraction` of it painted. */
export function ringDash(fraction: number, r: number): { circumference: number; offset: number } {
  const f = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0));
  const circumference = r2(2 * Math.PI * r);
  return { circumference, offset: r2(circumference * (1 - f)) };
}

/** Share of a total as a whole percent, 0 when the total is 0. */
export function sharePct(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
