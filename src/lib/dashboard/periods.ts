import { nextCairoDate, startOfCairoDay, utcToCairo } from "@/lib/datetime";
import { shiftDate } from "@/lib/services/calendar-grid";

/* ============================================================================
   The Home's PERIODS — "this month", "vs last month" and the six-month trend.

   Pure and STRING-BASED, the discipline of `cairoDatesBack` (ADR-081): every
   boundary is a Cairo calendar date "YYYY-MM-DD", stepped through the calendar
   with date arithmetic, and only turned into a UTC instant at the very end by
   `startOfCairoDay` — so the midnight-DST clamp is inherited, never re-derived.
   Nothing here subtracts hours from an instant: Egypt has a 23-hour day
   (2026-04-24) and a 25-hour day (2026-10-29), and a fixed 24 hours lands on
   the wrong Cairo date on exactly those two days a year.

   A period is INCLUSIVE in dates and HALF-OPEN in instants — [start, end) —
   the same tiling windows the To-Do and the daily report use, so two adjacent
   periods share a boundary instant and no lead can fall between them or count
   in both.

   "vs last month" ALWAYS means "vs the same point last month": on 25 October
   the comparison is 1–25 September, never the whole of September (which would
   make every month in progress look like a collapse). The card prints the
   compared dates, so the comparison is never vague.
   ========================================================================== */

export const RANGE_KEYS = ["mtd", "last_month", "7d", "30d", "qtd", "ytd"] as const;
export type RangeKey = (typeof RANGE_KEYS)[number];

export const DEFAULT_RANGE: RangeKey = "mtd";

export interface Period {
  /** first Cairo date, inclusive */
  from: string;
  /** last Cairo date, inclusive */
  to: string;
  /** UTC instant — the first moment of `from` in Cairo */
  start: Date;
  /** UTC instant — the first moment of the day AFTER `to` (exclusive end) */
  end: Date;
}

export interface PeriodPair {
  key: RangeKey;
  current: Period;
  previous: Period;
  /** six "YYYY-MM", oldest first, ending with the month of `current.to` */
  trendMonths: string[];
}

/** A stale or hand-typed link must still render: unknown → the default. */
export function parseRange(raw: string | string[] | undefined): RangeKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (RANGE_KEYS as readonly string[]).includes(value ?? "")
    ? (value as RangeKey)
    : DEFAULT_RANGE;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parts(date: string): { y: number; m: number; d: number } {
  const [y, m, d] = date.split("-").map(Number);
  if (![y, m, d].every((v) => Number.isFinite(v))) throw new Error(`Invalid date: ${date}`);
  return { y: y!, m: m!, d: d! };
}

const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** Days in a calendar month (m is 1–12). Day 0 of the next month is the last
    day of this one — no leap-year table of our own. */
export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The month `delta` months from (y, m), as { y, m }. */
function addMonths(y: number, m: number, delta: number): { y: number; m: number } {
  const index = y * 12 + (m - 1) + delta;
  return { y: Math.floor(index / 12), m: (index % 12) + 1 };
}

/** "YYYY-MM-DD" with the day clamped to the target month's length — 31 Oct
    one month back is 30 Sep, 29 Feb one year back is 28 Feb. */
function clampedDate(y: number, m: number, d: number): string {
  return ymd(y, m, Math.min(d, daysInMonth(y, m)));
}

/** Whole calendar days from `a` to `b` (b − a), on date strings. */
function dayDiff(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / 86_400_000);
}

/** min of two "YYYY-MM-DD" strings (lexicographic order is calendar order). */
const minDate = (a: string, b: string) => (a < b ? a : b);

/** Build a Period from inclusive Cairo dates. */
export function periodOf(from: string, to: string): Period {
  return { from, to, start: startOfCairoDay(from), end: startOfCairoDay(nextCairoDate(to)) };
}

/** The Cairo month "YYYY-MM" as a Period (the trend's buckets). */
export function monthPeriod(month: string): Period {
  const [y, m] = month.split("-").map(Number);
  return periodOf(ymd(y!, m!, 1), ymd(y!, m!, daysInMonth(y!, m!)));
}

function quarterStartMonth(m: number): number {
  return Math.floor((m - 1) / 3) * 3 + 1;
}

export function periodPair(key: RangeKey, now: Date): PeriodPair {
  const today = utcToCairo(now).date;
  const t = parts(today);
  let current: Period;
  let previous: Period;

  switch (key) {
    case "mtd": {
      const prev = addMonths(t.y, t.m, -1);
      current = periodOf(ymd(t.y, t.m, 1), today);
      previous = periodOf(ymd(prev.y, prev.m, 1), clampedDate(prev.y, prev.m, t.d));
      break;
    }
    case "last_month": {
      const last = addMonths(t.y, t.m, -1);
      const before = addMonths(t.y, t.m, -2);
      current = periodOf(ymd(last.y, last.m, 1), ymd(last.y, last.m, daysInMonth(last.y, last.m)));
      previous = periodOf(
        ymd(before.y, before.m, 1),
        ymd(before.y, before.m, daysInMonth(before.y, before.m)),
      );
      break;
    }
    case "7d":
    case "30d": {
      const n = key === "7d" ? 7 : 30;
      current = periodOf(shiftDate(today, -(n - 1)), today);
      previous = periodOf(shiftDate(today, -(2 * n - 1)), shiftDate(today, -n));
      break;
    }
    case "qtd": {
      const qm = quarterStartMonth(t.m);
      const from = ymd(t.y, qm, 1);
      const elapsed = dayDiff(from, today); // 0-based: today is day `elapsed` of the quarter
      const pq = addMonths(t.y, qm, -3);
      const pqFrom = ymd(pq.y, pq.m, 1);
      const pqEndMonth = addMonths(pq.y, pq.m, 2);
      const pqEnd = ymd(pqEndMonth.y, pqEndMonth.m, daysInMonth(pqEndMonth.y, pqEndMonth.m));
      current = periodOf(from, today);
      previous = periodOf(pqFrom, minDate(shiftDate(pqFrom, elapsed), pqEnd));
      break;
    }
    case "ytd": {
      current = periodOf(ymd(t.y, 1, 1), today);
      previous = periodOf(ymd(t.y - 1, 1, 1), clampedDate(t.y - 1, t.m, t.d));
      break;
    }
  }

  const end = parts(current.to);
  const trendMonths: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const mm = addMonths(end.y, end.m, -i);
    trendMonths.push(`${mm.y}-${pad(mm.m)}`);
  }
  return { key, current, previous, trendMonths };
}

/** Is an instant inside a period's half-open window? */
export function inPeriod(instant: Date | null | undefined, p: Period): boolean {
  if (!instant) return false;
  const t = instant.getTime();
  return t >= p.start.getTime() && t < p.end.getTime();
}

/** The Cairo dates a period covers, oldest first (for tiling checks). */
export function datesOf(p: Period): string[] {
  const out: string[] = [];
  for (let d = p.from; d <= p.to; d = shiftDate(d, 1)) out.push(d);
  return out;
}
