import { describe, expect, it } from "vitest";
import { computeLateness, isOverdue } from "./lateness";

/* ADR-053 — the lateness math mirrors the reference app's unit suite:
   its AC-10 / AC-11 cases, the midnight boundary, and the UTC-vs-Cairo edge.
   August dates: Cairo observes DST (UTC+3) in summer, standard UTC+2 in winter. */

describe("computeLateness", () => {
  it("three days after the deadline → late by 3 (reference AC-10)", () => {
    const completed = new Date("2026-08-13T10:00:00+03:00"); // 13 Aug, Cairo morning
    expect(computeLateness("2026-08-10", completed)).toEqual({ wasLate: true, daysLate: 3 });
  });

  it("23:30 Cairo on the deadline day is ON TIME (reference AC-11)", () => {
    const completed = new Date("2026-08-10T23:30:00+03:00");
    expect(computeLateness("2026-08-10", completed)).toEqual({ wasLate: false, daysLate: 0 });
  });

  it("00:10 Cairo the next day → late by 1 (midnight boundary)", () => {
    const completed = new Date("2026-08-11T00:10:00+03:00");
    expect(computeLateness("2026-08-10", completed)).toEqual({ wasLate: true, daysLate: 1 });
  });

  it("21:30 UTC on the deadline day is ALREADY 00:30 Cairo next day → late by 1", () => {
    const completed = new Date("2026-08-10T21:30:00Z"); // Cairo = UTC+3 in August
    expect(computeLateness("2026-08-10", completed)).toEqual({ wasLate: true, daysLate: 1 });
  });

  it("completing early is on time with zero days late (never negative)", () => {
    const completed = new Date("2026-08-05T09:00:00+03:00");
    expect(computeLateness("2026-08-10", completed)).toEqual({ wasLate: false, daysLate: 0 });
  });

  it("winter (standard time, UTC+2): 22:30 UTC is 00:30 Cairo next day → late by 1", () => {
    const completed = new Date("2026-01-10T22:30:00Z");
    expect(computeLateness("2026-01-10", completed)).toEqual({ wasLate: true, daysLate: 1 });
  });
});

describe("isOverdue (live flag, distinct from frozen wasLate)", () => {
  it("open task past its deadline is overdue; on the day it is not", () => {
    const now = new Date("2026-08-11T00:10:00+03:00"); // just past Cairo midnight
    expect(isOverdue("2026-08-10", now)).toBe(true);
    expect(isOverdue("2026-08-11", now)).toBe(false);
    expect(isOverdue("2026-08-12", now)).toBe(false);
  });
});
