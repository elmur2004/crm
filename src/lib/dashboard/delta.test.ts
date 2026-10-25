import { describe, expect, it } from "vitest";
import { countDelta, deltaArrow, deltaFigure, deltaTone, rateDelta, ratePct, rateOf } from "./delta";

/* §2.2 — every case the naive "(cur − prev) / prev" gets wrong, pinned. */

describe("countDelta", () => {
  it.each([
    [6, 3, { kind: "pct", pct: 100, dir: "up" }],
    [3, 2, { kind: "pct", pct: 50, dir: "up" }],
    [200_000, 150_000, { kind: "pct", pct: 33, dir: "up" }],
    [0, 150_000, { kind: "pct", pct: -100, dir: "down" }],
    [101, 100, { kind: "pct", pct: 1, dir: "up" }],
    [1000, 999, { kind: "pct", pct: 0, dir: "up" }],
    [999, 1000, { kind: "pct", pct: 0, dir: "down" }],
    [1, 2, { kind: "pct", pct: -50, dir: "down" }],
  ] as const)("(%s, %s)", (cur, prev, expected) => {
    expect(countDelta(cur, prev)).toEqual(expected);
  });

  it("2 vs 2 is No change; 0 vs 0 is No change, not an arrow", () => {
    expect(countDelta(2, 2)).toEqual({ kind: "same" });
    expect(countDelta(0, 0)).toEqual({ kind: "same" });
  });

  it("from nothing is New — never +∞% and never an invented +100%", () => {
    expect(countDelta(2, 0)).toEqual({ kind: "new" });
    expect(countDelta(50_000_00, 0)).toEqual({ kind: "new" });
  });
});

describe("rateDelta — percentage POINTS, never % of a %", () => {
  it("50% (1 won, 1 lost) vs 33% (1 won, 2 lost) is +17 pts", () => {
    expect(rateDelta({ won: 1, lost: 1 }, { won: 1, lost: 2 })).toEqual({ kind: "pts", pts: 17, dir: "up" });
  });

  it("50% vs 100% is −50 pts", () => {
    expect(rateDelta({ won: 1, lost: 1 }, { won: 1, lost: 0 })).toEqual({ kind: "pts", pts: -50, dir: "down" });
  });

  it("no decided deal on either side is n/a — the badge reads '—'", () => {
    expect(rateDelta({ won: 0, lost: 0 }, { won: 1, lost: 1 })).toEqual({ kind: "na" });
    expect(rateDelta({ won: 1, lost: 0 }, { won: 0, lost: 0 })).toEqual({ kind: "na" });
    expect(rateDelta(null, null)).toEqual({ kind: "na" });
  });

  it("equal rates are No change even when the counts differ", () => {
    expect(rateDelta({ won: 2, lost: 2 }, { won: 1, lost: 1 })).toEqual({ kind: "same" });
  });

  it("a real move under one point is '<1', with its direction", () => {
    const d = rateDelta({ won: 501, lost: 500 }, { won: 500, lost: 500 });
    expect(d).toEqual({ kind: "pts", pts: 0, dir: "up" });
    expect(deltaFigure(d)).toBe("<1");
  });
});

describe("rateOf / ratePct", () => {
  it("is null with nothing decided, a fraction otherwise", () => {
    expect(rateOf({ won: 0, lost: 0 })).toBeNull();
    expect(rateOf({ won: 1, lost: 2 })).toBeCloseTo(1 / 3);
    expect(ratePct({ won: 1, lost: 2 })).toBe(33);
    expect(ratePct({ won: 0, lost: 1 })).toBe(0);
    expect(ratePct(null)).toBeNull();
  });
});

describe("display", () => {
  it("prints the true minus sign U+2212, a plus, and '<1%'", () => {
    expect(deltaFigure({ kind: "pct", pct: -100, dir: "down" })).toBe("−100%");
    expect(deltaFigure({ kind: "pct", pct: 33, dir: "up" })).toBe("+33%");
    expect(deltaFigure({ kind: "pct", pct: 0, dir: "up" })).toBe("<1%");
    expect(deltaFigure({ kind: "pts", pts: 17, dir: "up" })).toBe("+17");
    expect(deltaFigure({ kind: "new" })).toBeNull();
  });

  it("arrows and tones: up is favourable on every Home KPI; words are neutral", () => {
    expect(deltaArrow({ kind: "pct", pct: 5, dir: "up" })).toBe("↑");
    expect(deltaArrow({ kind: "pts", pts: -5, dir: "down" })).toBe("↓");
    expect(deltaArrow({ kind: "same" })).toBe("");
    expect(deltaTone({ kind: "pct", pct: 5, dir: "up" })).toBe("good");
    expect(deltaTone({ kind: "pct", pct: -5, dir: "down" })).toBe("bad");
    for (const k of ["new", "same", "na"] as const) expect(deltaTone({ kind: k })).toBe("neutral");
  });
});
