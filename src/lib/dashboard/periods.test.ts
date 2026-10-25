import { describe, expect, it } from "vitest";
import { cairoDayWindowFor, cairoToUtc, startOfCairoDay } from "@/lib/datetime";
import {
  DEFAULT_RANGE,
  RANGE_KEYS,
  datesOf,
  daysInMonth,
  inPeriod,
  monthPeriod,
  parseRange,
  periodPair,
} from "./periods";

/* The Home's periods. Every boundary is a CAIRO date and every instant comes
   out of startOfCairoDay, so these assertions hold on any machine in any zone. */

const NOW = cairoToUtc("2026-10-25", "13:00");

describe("parseRange — a stale link still renders", () => {
  it("accepts every key and falls back to This month for anything else", () => {
    for (const k of RANGE_KEYS) expect(parseRange(k)).toBe(k);
    expect(parseRange(undefined)).toBe(DEFAULT_RANGE);
    expect(parseRange("forever")).toBe("mtd");
    expect(parseRange(["last_month", "7d"])).toBe("last_month");
    expect(parseRange("")).toBe("mtd");
  });
});

describe("periodPair — the current window and its 'vs' window", () => {
  it("mtd on 25 Oct: 1–25 Oct vs 1–25 Sep (the same point last month)", () => {
    const p = periodPair("mtd", NOW);
    expect([p.current.from, p.current.to]).toEqual(["2026-10-01", "2026-10-25"]);
    expect([p.previous.from, p.previous.to]).toEqual(["2026-09-01", "2026-09-25"]);
    expect(p.current.start).toEqual(startOfCairoDay("2026-10-01"));
    expect(p.current.end).toEqual(startOfCairoDay("2026-10-26"));
    expect(p.previous.end).toEqual(startOfCairoDay("2026-09-26"));
  });

  it("mtd on 31 Oct clamps the previous window to 30 Sep", () => {
    const p = periodPair("mtd", cairoToUtc("2026-10-31", "09:00"));
    expect([p.previous.from, p.previous.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("mtd on 31 March clamps to 28 February (and 29 in a leap year)", () => {
    expect(periodPair("mtd", cairoToUtc("2026-03-31", "09:00")).previous.to).toBe("2026-02-28");
    expect(periodPair("mtd", cairoToUtc("2028-03-31", "09:00")).previous.to).toBe("2028-02-29");
  });

  it("mtd in January compares with December of the year before", () => {
    const p = periodPair("mtd", cairoToUtc("2027-01-12", "09:00"));
    expect([p.previous.from, p.previous.to]).toEqual(["2026-12-01", "2026-12-12"]);
  });

  it("last_month: the whole of September vs the whole of August", () => {
    const p = periodPair("last_month", NOW);
    expect([p.current.from, p.current.to]).toEqual(["2026-09-01", "2026-09-30"]);
    expect([p.previous.from, p.previous.to]).toEqual(["2026-08-01", "2026-08-31"]);
  });

  it("7d and 30d: the N days ending today vs the N days before", () => {
    const w = periodPair("7d", NOW);
    expect([w.current.from, w.current.to]).toEqual(["2026-10-19", "2026-10-25"]);
    expect([w.previous.from, w.previous.to]).toEqual(["2026-10-12", "2026-10-18"]);
    const m = periodPair("30d", NOW);
    expect([m.current.from, m.current.to]).toEqual(["2026-09-26", "2026-10-25"]);
    expect([m.previous.from, m.previous.to]).toEqual(["2026-08-27", "2026-09-25"]);
    /* adjacent: the previous window ends exactly where the current starts */
    expect(w.previous.end).toEqual(w.current.start);
    expect(m.previous.end).toEqual(m.current.start);
  });

  it("qtd: 1 Oct → today vs the same elapsed days of Q3", () => {
    const p = periodPair("qtd", NOW);
    expect([p.current.from, p.current.to]).toEqual(["2026-10-01", "2026-10-25"]);
    expect([p.previous.from, p.previous.to]).toEqual(["2026-07-01", "2026-07-25"]);
  });

  it("qtd late in a long quarter clamps to the previous quarter's end", () => {
    /* Q1 2027 has 90 days; on 31 Mar (day 90) the previous quarter (Q4, 92
       days) is not clamped — but on 30 Jun (day 91 of Q2) Q1 must stop at 31 Mar */
    const p = periodPair("qtd", cairoToUtc("2027-06-30", "09:00"));
    expect([p.previous.from, p.previous.to]).toEqual(["2027-01-01", "2027-03-31"]);
  });

  it("ytd: 1 Jan → today vs the same span last year; 29 Feb clamps to 28 Feb", () => {
    const p = periodPair("ytd", NOW);
    expect([p.current.from, p.current.to]).toEqual(["2026-01-01", "2026-10-25"]);
    expect([p.previous.from, p.previous.to]).toEqual(["2025-01-01", "2025-10-25"]);
    expect(periodPair("ytd", cairoToUtc("2028-02-29", "09:00")).previous.to).toBe("2027-02-28");
  });

  it("trendMonths: six months, oldest first, ending with the period's month", () => {
    expect(periodPair("mtd", NOW).trendMonths).toEqual([
      "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10",
    ]);
    expect(periodPair("last_month", NOW).trendMonths.at(-1)).toBe("2026-09");
    expect(periodPair("mtd", cairoToUtc("2027-02-03", "09:00")).trendMonths).toEqual([
      "2026-09", "2026-10", "2026-11", "2026-12", "2027-01", "2027-02",
    ]);
  });
});

describe("the Cairo boundary — never the UTC month", () => {
  it("00:30 Cairo on 1 Oct is still 30 Sep in UTC, and it counts in OCTOBER", () => {
    const b1 = cairoToUtc("2026-10-01", "00:30");
    expect(b1.toISOString().startsWith("2026-09-30")).toBe(true);
    const p = periodPair("mtd", NOW);
    expect(inPeriod(b1, p.current)).toBe(true);
    expect(inPeriod(b1, p.previous)).toBe(false);
  });

  it("23:30 Cairo on 25 Sep is inside the previous mtd window (which ends 26 Sep 00:00)", () => {
    const p = periodPair("mtd", NOW);
    expect(inPeriod(cairoToUtc("2026-09-25", "23:30"), p.previous)).toBe(true);
    expect(inPeriod(cairoToUtc("2026-09-26", "00:00"), p.previous)).toBe(false);
  });
});

describe("DST — Egypt's 23-hour and 25-hour days", () => {
  it("mtd on 30 Oct ends at 31 Oct 00:00 Cairo — a +02:00 instant after the fall-back", () => {
    const p = periodPair("mtd", cairoToUtc("2026-10-30", "12:00"));
    expect(p.current.end.toISOString()).toBe("2026-10-30T22:00:00.000Z");
    /* and October 1 is still summer time, +03:00 */
    expect(p.current.start.toISOString()).toBe("2026-09-30T21:00:00.000Z");
    expect([p.previous.from, p.previous.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("on 31 Oct the previous window is all of September, by the clamp", () => {
    const p = periodPair("mtd", cairoToUtc("2026-10-31", "12:00"));
    expect([p.previous.from, p.previous.to]).toEqual(["2026-09-01", "2026-09-30"]);
  });

  it("7d across the 23-hour day (24 Apr 2026): seven day-windows tile exactly", () => {
    const p = periodPair("7d", cairoToUtc("2026-04-26", "12:00"));
    expect([p.current.from, p.current.to]).toEqual(["2026-04-20", "2026-04-26"]);
    const days = datesOf(p.current);
    expect(days).toHaveLength(7);
    const windows = days.map(cairoDayWindowFor);
    expect(windows[0]!.start).toEqual(p.current.start);
    expect(windows.at(-1)!.end).toEqual(p.current.end);
    for (let i = 1; i < windows.length; i++) expect(windows[i]!.start).toEqual(windows[i - 1]!.end);
    /* one hour short of seven whole days: 24 April has no 00:00–01:00 */
    expect(p.current.end.getTime() - p.current.start.getTime()).toBe((7 * 24 - 1) * 3_600_000);
  });

  it("October 2026, the month with the 25-hour day, is 31 × 24 + 1 hours", () => {
    const oct = monthPeriod("2026-10");
    expect(oct.end.getTime() - oct.start.getTime()).toBe((31 * 24 + 1) * 3_600_000);
  });
});

describe("daysInMonth", () => {
  it("knows February", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 9)).toBe(30);
    expect(daysInMonth(2026, 12)).toBe(31);
  });
});
