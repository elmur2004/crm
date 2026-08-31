import { describe, expect, it } from "vitest";
import { utcToCairo } from "@/lib/datetime";
import {
  dayOfWeek,
  monthGrid,
  monthOf,
  parseMonth,
  shiftDate,
  shiftMonth,
  WEEK_STARTS_ON,
} from "./calendar-grid";

/* ADR-071 — the month grid is pure arithmetic, so it is tested as arithmetic:
   no database, no clock, no timezone of the machine running this. Every case
   below would have caught a real off-by-one in an earlier draft. */

describe("the month grid", () => {
  it("starts on Sunday and always holds whole weeks", () => {
    /* twelve consecutive months, so a leap February and both 30- and 31-day
       months are covered without listing them by hand */
    for (let m = 1; m <= 12; m++) {
      const grid = monthGrid(2026, m);
      expect(grid.days.length % 7).toBe(0);
      expect(dayOfWeek(grid.days[0]!.date)).toBe(WEEK_STARTS_ON);
      expect(dayOfWeek(grid.days[grid.days.length - 1]!.date)).toBe(6);
    }
  });

  it("marks exactly the month's own days as in-month, and no others", () => {
    const grid = monthGrid(2026, 8); // August 2026 — 31 days
    const inMonth = grid.days.filter((d) => d.inMonth);
    expect(inMonth.length).toBe(31);
    expect(inMonth[0]!.date).toBe("2026-08-01");
    expect(inMonth[30]!.date).toBe("2026-08-31");
    for (const d of grid.days) {
      expect(d.inMonth).toBe(d.date.startsWith("2026-08"));
    }
  });

  it("handles February in a leap year and in a common one", () => {
    expect(monthGrid(2028, 2).days.filter((d) => d.inMonth).length).toBe(29);
    expect(monthGrid(2026, 2).days.filter((d) => d.inMonth).length).toBe(28);
  });

  it("window [from, to) covers the first cell and stops after the last", () => {
    const grid = monthGrid(2026, 8);
    expect(utcToCairo(grid.from).date).toBe(grid.days[0]!.date);
    /* `to` is EXCLUSIVE: the instant before it is still the last cell's day,
       and `to` itself is already the day after. A grid whose `to` landed on
       the last day would drop everything after midnight on it. */
    expect(utcToCairo(new Date(grid.to.getTime() - 1)).date).toBe(
      grid.days[grid.days.length - 1]!.date,
    );
    expect(utcToCairo(grid.to).date).toBe(shiftDate(grid.days[grid.days.length - 1]!.date, 1));
  });

  it("covers every day of the month with no gap and no repeat", () => {
    const grid = monthGrid(2026, 3); // Egypt's DST jump falls in this month
    const dates = grid.days.map((d) => d.date);
    expect(new Set(dates).size).toBe(dates.length);
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBe(shiftDate(dates[i - 1]!, 1));
    }
  });
});

describe("date arithmetic", () => {
  it("rolls months and years", () => {
    expect(shiftDate("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29"); // leap
  });

  it("names the weekday of a known date", () => {
    expect(dayOfWeek("2026-08-31")).toBe(1); // a Monday
    expect(dayOfWeek("2026-08-30")).toBe(0); // the Sunday before it
  });

  it("shifts months across a year boundary in both directions", () => {
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 6, -18)).toEqual({ year: 2024, month: 12 });
  });

  it("reads the Cairo month of an instant, not the machine's", () => {
    /* 2026-08-31T22:30Z is already 2026-09-01 in Cairo (UTC+3 in summer) */
    expect(monthOf(new Date("2026-08-31T22:30:00Z"))).toEqual({ year: 2026, month: 9 });
  });
});

describe("parseMonth — the query string is untrusted", () => {
  it("accepts a real month", () => {
    expect(parseMonth("2026", "8")).toEqual({ year: 2026, month: 8 });
  });

  it("refuses junk, out-of-range values and repeated parameters", () => {
    for (const bad of [
      ["2026", "13"],
      ["2026", "0"],
      ["1999", "6"],
      ["2101", "6"],
      ["abc", "6"],
      ["2026", ""],
      [undefined, undefined],
    ] as const) {
      expect(parseMonth(bad[0], bad[1])).toBeNull();
    }
    /* a repeated ?y=2026&y=2027 arrives as an array and is junk, exactly as
       `parseCompany` treats a repeated ?company= (ACCESS AUDIT, Run 081) */
    expect(parseMonth(["2026", "2027"], "8")).toBeNull();
  });

  it("does not loop or explode on a fuzzed year", () => {
    expect(parseMonth("99999999", "8")).toBeNull();
  });
});
