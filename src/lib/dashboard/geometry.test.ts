import { describe, expect, it } from "vitest";
import {
  arcPath,
  barLayout,
  funnelLayout,
  linePath,
  niceMax,
  normalise,
  ringDash,
  scaleLinear,
  sharePct,
} from "./geometry";

describe("zero is a real answer — never NaN", () => {
  it("all-zero bars have zero size", () => {
    const bars = barLayout([0, 0, 0]);
    expect(bars.map((b) => b.size)).toEqual([0, 0, 0]);
    for (const b of bars) expect(Number.isNaN(b.size)).toBe(false);
  });

  it("a scale with a zero maximum maps everything to 0", () => {
    const s = scaleLinear(0, 300);
    expect(s(0)).toBe(0);
    expect(s(5)).toBe(0);
  });

  it("an empty funnel has zero widths and no step-to-step rate", () => {
    const f = funnelLayout([0, 0, 0]);
    expect(f.map((s) => s.widthPct)).toEqual([0, 0, 0]);
    expect(f.map((s) => s.pctOfPrev)).toEqual([null, null, null]);
  });

  it("an all-zero series normalises to zeros", () => {
    expect(normalise([0, 0])).toEqual([0, 0]);
  });
});

describe("scales and bars", () => {
  it("scaleLinear is proportional and clamps", () => {
    const s = scaleLinear(10, 200);
    expect(s(5)).toBe(100);
    expect(s(20)).toBe(200);
    expect(s(-3)).toBe(0);
  });

  it("niceMax rounds up to a 1-2-5 step", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(13)).toBe(20);
    expect(niceMax(42)).toBe(50);
    expect(niceMax(100)).toBe(100);
  });

  it("barLayout is relative to the largest value", () => {
    expect(barLayout([2, 1, 0, 4]).map((b) => b.size)).toEqual([0.5, 0.25, 0, 1]);
  });

  it("sharePct is a whole percent and 0 of nothing is 0", () => {
    expect(sharePct(1, 6)).toBe(17);
    expect(sharePct(0, 0)).toBe(0);
  });
});

describe("funnelLayout", () => {
  it("[6,6,5,4,2,1] → pctOfFirst [100,100,83,67,33,17]", () => {
    const f = funnelLayout([6, 6, 5, 4, 2, 1]);
    expect(f.map((s) => s.pctOfFirst)).toEqual([100, 100, 83, 67, 33, 17]);
    expect(f[0]!.pctOfPrev).toBeNull();
    expect(f[2]!.pctOfPrev).toBe(83); // 5 of 6
    expect(f[3]!.pctOfPrev).toBe(80); // 4 of 5
    expect(f[1]!.widthPct).toBe(100);
  });
});

describe("linePath — gaps break the line", () => {
  it("a null is a gap: the next point starts a new M", () => {
    const { d, xs, ys } = linePath([null, 0.5, 1, null, 0, 0.5], 100, 50);
    expect(xs).toEqual([0, 20, 40, 60, 80, 100]);
    expect(ys).toEqual([null, 25, 0, null, 50, 25]);
    expect(d).toBe("M20 25 L40 0 M80 50 L100 25");
  });

  it("all gaps draw nothing", () => {
    expect(linePath([null, null], 100, 50).d).toBe("");
  });

  it("RTL mirrors the x positions (D11b is one flag)", () => {
    expect(linePath([0, 1], 100, 50, { dir: "rtl" }).xs).toEqual([100, 0]);
  });

  it("a single point sits in the middle", () => {
    expect(linePath([1], 100, 50).xs).toEqual([50]);
  });
});

describe("arcPath — the semicircle meter", () => {
  it("is empty at 0 and a full half-circle at 1", () => {
    expect(arcPath(0, 40)).toBe("");
    expect(arcPath(1, 40)).toBe("M0 40 A40 40 0 0 1 80 40");
  });

  it("at 0.5 it ends at the top centre", () => {
    expect(arcPath(0.5, 40)).toBe("M0 40 A40 40 0 0 1 40 0");
  });

  it("RTL mirrors it: starts at the right end and sweeps the other way", () => {
    expect(arcPath(0.5, 40, { dir: "rtl" })).toBe("M80 40 A40 40 0 0 0 40 0");
    const ltr = arcPath(0.25, 40).match(/[\d.]+/g)!.map(Number);
    const rtl = arcPath(0.25, 40, { dir: "rtl" }).match(/[\d.]+/g)!.map(Number);
    /* M x y A rx ry rot large sweep x y — mirrored x on both ends */
    expect(rtl[0]).toBeCloseTo(80 - ltr[0]!);
    expect(rtl[7]).toBeCloseTo(80 - ltr[7]!);
    expect(rtl[8]).toBeCloseTo(ltr[8]!);
  });

  it("clamps out-of-range and NaN fractions", () => {
    expect(arcPath(2, 40)).toBe(arcPath(1, 40));
    expect(arcPath(Number.NaN, 40)).toBe("");
  });
});

describe("ringDash", () => {
  it("leaves the fraction painted", () => {
    const r = ringDash(0.25, 10);
    expect(r.circumference).toBeCloseTo(62.83, 1);
    expect(r.offset).toBeCloseTo(47.12, 1);
    expect(ringDash(0, 10).offset).toBe(ringDash(0, 10).circumference);
    expect(ringDash(1, 10).offset).toBe(0);
  });
});
