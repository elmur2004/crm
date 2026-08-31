import { startOfCairoDay, utcToCairo } from "@/lib/datetime";

/* ============================================================================
   ADR-071 — the MONTH GRID: pure calendar arithmetic, no database, no React.

   It exists as its own module for the reason `lib/crm/company.ts` does: the
   page, the client grid and the unit tests must agree on which days are on
   screen, and they agree by importing the same function rather than by three
   people implementing the same off-by-one.

   EVERY DATE HERE IS A CAIRO CALENDAR DATE, "YYYY-MM-DD" — the ADR-052 string
   convention this codebase already uses for deadlines and sheet dates. Only
   `from`/`to` are instants, and they are produced by `startOfCairoDay`, so the
   DST clamp is inherited rather than re-derived.
   ========================================================================== */

/** The week starts on SUNDAY.

    Egypt's working week is Sunday–Thursday and its weekend is Friday–Saturday.
    A Sunday-first grid therefore puts the five working days first and the two
    weekend days in the last two columns, which is how a business calendar is
    read here. (`ar-EG`'s CLDR first-day is Saturday — that is the civil week,
    not the working one, and it would split the weekend across both edges of
    the row.) Exported so the header strip and the grid cannot disagree. */
export const WEEK_STARTS_ON = 0; // 0 = Sunday

const pad = (n: number) => String(n).padStart(2, "0");

/** A Cairo date string as a UTC instant at NOON — a safe handle for day
    arithmetic. Noon, not midnight: Cairo is UTC+2/+3, so noon UTC always falls
    on the same calendar date in Cairo, whatever the offset or the DST jump. */
function noonOf(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!, 12));
}

const dateOf = (noon: Date): string =>
  `${noon.getUTCFullYear()}-${pad(noon.getUTCMonth() + 1)}-${pad(noon.getUTCDate())}`;

/** Calendar-day shift on a "YYYY-MM-DD" string. Month and year roll over. */
export function shiftDate(date: string, days: number): string {
  const n = noonOf(date);
  n.setUTCDate(n.getUTCDate() + days);
  return dateOf(n);
}

/** 0 = Sunday … 6 = Saturday, for a Cairo calendar date. */
export function dayOfWeek(date: string): number {
  return noonOf(date).getUTCDay();
}

export interface CalendarDay {
  /** Cairo calendar date, "YYYY-MM-DD". */
  date: string;
  /** false for the leading/trailing days borrowed from the neighbouring month. */
  inMonth: boolean;
}

export interface MonthGrid {
  year: number;
  /** 1–12. */
  month: number;
  /** Whole weeks, Sunday-first — always a multiple of 7. */
  days: CalendarDay[];
  /** First instant of the first cell's Cairo day. */
  from: Date;
  /** First instant of the day AFTER the last cell — a half-open [from, to). */
  to: Date;
}

/** The visible grid for one Cairo month, padded out to whole weeks. */
export function monthGrid(year: number, month: number): MonthGrid {
  const first = `${year}-${pad(month)}-01`;
  /* day 0 of the NEXT month is the last day of this one — the standard trick,
     and it needs no leap-year table of its own */
  const lastDayNumber = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${pad(month)}-${pad(lastDayNumber)}`;

  const lead = (dayOfWeek(first) - WEEK_STARTS_ON + 7) % 7;
  const trail = 6 - ((dayOfWeek(last) - WEEK_STARTS_ON + 7) % 7);

  const days: CalendarDay[] = [];
  let cursor = shiftDate(first, -lead);
  const total = lead + lastDayNumber + trail;
  for (let i = 0; i < total; i++) {
    days.push({ date: cursor, inMonth: cursor >= first && cursor <= last });
    cursor = shiftDate(cursor, 1);
  }

  return {
    year,
    month,
    days,
    from: startOfCairoDay(days[0]!.date),
    /* `cursor` has already stepped one past the final cell, so it IS the
       exclusive end — no second shift, and nothing to get wrong at a month
       boundary. */
    to: startOfCairoDay(cursor),
  };
}

/** The month a Cairo instant falls in — how "today" becomes a default view. */
export function monthOf(instant: Date): { year: number; month: number } {
  const [y, m] = utcToCairo(instant).date.split("-").map(Number);
  return { year: y!, month: m! };
}

/** Step a month by ±n, rolling the year. Used by the prev/next buttons, which
    build a URL rather than holding state — so this has to be pure. */
export function shiftMonth(
  year: number,
  month: number,
  by: number,
): { year: number; month: number } {
  const zero = year * 12 + (month - 1) + by;
  return { year: Math.floor(zero / 12), month: (((zero % 12) + 12) % 12) + 1 };
}

/** Clamp a `?y=&m=` pair off the wire to a real month, or null when it is junk.
    The page falls back to today's month on null — the accounting precedent: a
    page falls back, it does not 400 on a bad query string. */
export function parseMonth(
  rawYear: string | readonly string[] | undefined | null,
  rawMonth: string | readonly string[] | undefined | null,
): { year: number; month: number } | null {
  const one = (v: string | readonly string[] | undefined | null) =>
    Array.isArray(v) ? (v.length === 1 ? v[0] : undefined) : (v as string | undefined);
  const y = Number(one(rawYear));
  const m = Number(one(rawMonth));
  if (!Number.isInteger(y) || !Number.isInteger(m)) return null;
  /* a range wide enough for any record this product will hold, and narrow
     enough that a fuzzed `?y=99999999` cannot make the grid loop for a year */
  if (y < 2000 || y > 2100 || m < 1 || m > 12) return null;
  return { year: y, month: m };
}
