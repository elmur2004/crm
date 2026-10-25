/* ============================================================================
   The KPI delta badge — "↑12% vs last month". Pure, unit-tested.

   The rules are the honest ones, and each exists because the naive formula
   lies in a specific case:
   · prev = 0, cur > 0 is "New" — never "+∞%" and never a made-up "+100%".
   · 0 = 0 is "No change", not an arrow.
   · a change that rounds to 0% is still a change: "<1%", with its direction.
   · a RATE moves in percentage POINTS, never in "% of a %": 33% → 50% is
     "+17 pts", because "+50%" would describe the same move three ways.
   · a rate with no decided deal on either side cannot be compared at all, so
     the badge says "—" rather than inventing a 0%.
   ========================================================================== */

export interface Rate {
  won: number;
  lost: number;
}

export type Delta =
  /** prev > 0 and cur ≠ prev. `pct` is the signed, rounded change; 0 means
      the change was real but under one percent ("<1%"). */
  | { kind: "pct"; pct: number; dir: "up" | "down" }
  /** a rate's change in percentage POINTS; 0 means "<1 pt" */
  | { kind: "pts"; pts: number; dir: "up" | "down" }
  | { kind: "new" }
  | { kind: "same" }
  | { kind: "na" };

export function countDelta(cur: number, prev: number): Delta {
  if (cur === prev) return { kind: "same" };
  if (prev <= 0) return cur > 0 ? { kind: "new" } : { kind: "same" };
  const pct = Math.round(((cur - prev) / prev) * 100);
  return { kind: "pct", pct: Object.is(pct, -0) ? 0 : pct, dir: cur > prev ? "up" : "down" };
}

/** won ÷ (won + lost), or null when nothing was decided. */
export function rateOf(r: Rate | null | undefined): number | null {
  if (!r) return null;
  const decided = r.won + r.lost;
  return decided > 0 ? r.won / decided : null;
}

export function rateDelta(cur: Rate | null | undefined, prev: Rate | null | undefined): Delta {
  const a = rateOf(cur);
  const b = rateOf(prev);
  if (a === null || b === null) return { kind: "na" };
  if (a === b) return { kind: "same" };
  const pts = Math.round(a * 100 - b * 100);
  return { kind: "pts", pts: Object.is(pts, -0) ? 0 : pts, dir: a > b ? "up" : "down" };
}

/** A whole-number percentage for display ("50%"), or null for "—". */
export function ratePct(r: Rate | null | undefined): number | null {
  const v = rateOf(r);
  return v === null ? null : Math.round(v * 100);
}

const MINUS = "−"; // U+2212 — the true minus sign, never a hyphen

/** The badge's number, language-neutral (Latin digits, rendered inside <bdi>).
    Returns null for the kinds whose label is a WORD ("New", "No change", "—"),
    which the caller translates. */
export function deltaFigure(d: Delta): string | null {
  if (d.kind === "pct") {
    if (d.pct === 0) return "<1%";
    return `${d.dir === "up" ? "+" : MINUS}${Math.abs(d.pct)}%`;
  }
  if (d.kind === "pts") {
    if (d.pts === 0) return "<1";
    return `${d.dir === "up" ? "+" : MINUS}${Math.abs(d.pts)}`;
  }
  return null;
}

/** ↑ ↓ — vertical arrows need no RTL mirroring. */
export function deltaArrow(d: Delta): string {
  if (d.kind === "pct" || d.kind === "pts") return d.dir === "up" ? "↑" : "↓";
  return "";
}

/** Every KPI on the Home treats ↑ as favourable (§3). The tone is a second
    channel beside the arrow and the sign, never the only one. */
export function deltaTone(d: Delta): "good" | "bad" | "neutral" {
  if (d.kind === "pct" || d.kind === "pts") return d.dir === "up" ? "good" : "bad";
  return "neutral";
}
