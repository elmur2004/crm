import { describe, expect, it } from "vitest";
import { cairoToUtc, sameCairoDay, utcToCairo } from "./datetime";

/* ADR-061 — the boards' Today chip compares CAIRO calendar days, never local
   Date parts. Fixed instants: the assertions hold on any machine in any zone. */

describe("sameCairoDay (ADR-061)", () => {
  it("early-morning Cairo belongs to the CAIRO day even though UTC is still yesterday", () => {
    // 2026-08-19T21:30Z is 2026-08-20 00:30 in Cairo (UTC+3)
    const earlyCairo = new Date("2026-08-19T21:30:00Z");
    const noonCairo = cairoToUtc("2026-08-20", "12:00");
    expect(utcToCairo(earlyCairo).date).toBe("2026-08-20");
    expect(sameCairoDay(earlyCairo, noonCairo)).toBe(true);
  });

  it("the 09:00-Cairo default slot (ADR-061) lands on its own calendar day, and yesterday's does not", () => {
    const now = cairoToUtc("2026-08-20", "12:00");
    expect(sameCairoDay(cairoToUtc("2026-08-20", "09:00"), now)).toBe(true);
    expect(sameCairoDay(cairoToUtc("2026-08-19", "09:00"), now)).toBe(false);
    expect(sameCairoDay(cairoToUtc("2026-08-21", "09:00"), now)).toBe(false);
  });

  it("last instant of the day vs first of the next — different Cairo days across midnight", () => {
    expect(
      sameCairoDay(cairoToUtc("2026-08-20", "23:59"), cairoToUtc("2026-08-21", "00:00")),
    ).toBe(false);
  });
});
