import { describe, expect, it } from "vitest";
import {
  cairoToUtc,
  formatCairo,
  formatCairoDate,
  formatCairoShort,
  sameCairoDay,
  utcToCairo,
} from "./datetime";

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

/* ------------------------------------------------------------------ ADR-068 */

/* Founder: "use the twelve hour timing, not the twenty four hour timing. And
   this is through the entire system." The table below IS the contract — one
   row per hour a twelve-hour clock can get wrong, in both languages. Midnight
   and noon are the rows that matter: they are the only two where a broken
   formatter still looks plausible while being twelve hours out. */

const D = "20 Aug 2026";
const DA = "20 أغسطس 2026";

describe("formatCairo — the twelve-hour display clock (ADR-068)", () => {
  it.each([
    ["00:00", "12:00 AM", "12:00 ص"],
    ["00:30", "12:30 AM", "12:30 ص"],
    ["01:30", "1:30 AM", "1:30 ص"],
    ["09:00", "9:00 AM", "9:00 ص"],
    ["11:59", "11:59 AM", "11:59 ص"],
    ["12:00", "12:00 PM", "12:00 م"],
    ["12:30", "12:30 PM", "12:30 م"],
    ["14:00", "2:00 PM", "2:00 م"],
    ["16:45", "4:45 PM", "4:45 م"],
    ["18:30", "6:30 PM", "6:30 م"],
    ["23:45", "11:45 PM", "11:45 م"],
    ["23:59", "11:59 PM", "11:59 م"],
  ])("%s Cairo reads %s in English and %s in Arabic", (wall, en, ar) => {
    const at = cairoToUtc("2026-08-20", wall);
    expect(formatCairo(at, "en")).toBe(`${D}, ${en}`);
    expect(formatCairo(at, "ar")).toBe(`${DA}، ${ar}`);
  });

  it("never prints a 24-hour hour, in either language", () => {
    for (let h = 0; h < 24; h++) {
      const at = cairoToUtc("2026-08-20", `${String(h).padStart(2, "0")}:15`);
      for (const locale of ["en", "ar"] as const) {
        expect(formatCairo(at, locale)).not.toMatch(/\b(1[3-9]|2[0-3]):[0-5][0-9]\b/);
      }
    }
  });

  it("the English marker is UPPERCASE and the Arabic one is ص / م — never a latin AM/PM", () => {
    const morning = cairoToUtc("2026-08-20", "09:00");
    const evening = cairoToUtc("2026-08-20", "21:00");
    expect(formatCairo(morning, "en")).toContain("AM");
    expect(formatCairo(evening, "en")).toContain("PM");
    expect(formatCairo(morning, "ar")).toContain("\u0635");
    expect(formatCairo(evening, "ar")).toContain("\u0645");
    expect(formatCairo(evening, "ar")).not.toMatch(/[AP]M/i);
  });

  /* ICU >= 72 emits U+202F (NARROW NO-BREAK SPACE) before the day period in
     several locale/version pairs. Without this guard a Node upgrade turns every
     "2:30 PM" assertion in the e2e suite red with no code change, and the
     failure reads like a spacing typo rather than an ICU bump. */
  it("separates the clock from its marker with a PLAIN space (U+0020), not U+202F", () => {
    const at = cairoToUtc("2026-08-20", "14:30");
    for (const locale of ["en", "ar"] as const) {
      const s = formatCairo(at, locale);
      const marker = locale === "en" ? "PM" : "\u0645";
      const i = s.indexOf(marker);
      expect(s.codePointAt(i - 1)).toBe(0x20);
    }
    expect(formatCairo(at, "en")).not.toContain("\u202f");
    expect(formatCairo(at, "ar")).not.toContain("\u202f");
  });

  it("Arabic renders in Arabic with LATIN digits — no Arabic-Indic numerals anywhere", () => {
    const s = formatCairo(cairoToUtc("2026-08-20", "18:30"), "ar");
    expect(s).toBe("20 أغسطس 2026، 6:30 م");
    expect(s).not.toMatch(/[\u0660-\u0669]/);
  });

  it("a null instant is still an em dash, in both languages", () => {
    expect(formatCairo(null, "en")).toBe("—");
    expect(formatCairo(undefined, "ar")).toBe("—");
  });
});

describe("formatCairoDate — the date-only rendering did NOT move", () => {
  it("English is byte-identical to what it printed before the clock changed", () => {
    expect(formatCairoDate(cairoToUtc("2026-08-08", "14:30"), "en")).toBe("8 Aug 2026");
    expect(formatCairoDate(cairoToUtc("2026-01-01", "00:00"), "en")).toBe("1 Jan 2026");
  });

  it("carries no clock at all — a UTC-midnight statement date can never grow a 2:00 AM", () => {
    /* Statements, milestones and contract dates are stored as UTC midnight.
       Rendered WITH a clock they would read "2:00 AM" in Cairo — the trap the
       To-Do already closes by passing withTime:false for the money kinds. */
    const utcMidnight = new Date("2026-09-15T00:00:00.000Z");
    expect(formatCairoDate(utcMidnight, "en")).toMatch(/^15 Sept? 2026$/);
    expect(formatCairoDate(utcMidnight, "ar")).toBe("15 سبتمبر 2026");
    for (const locale of ["en", "ar"] as const) {
      expect(formatCairoDate(utcMidnight, locale)).not.toMatch(/\d:\d/);
    }
  });

  it("Arabic is Arabic — the same date, so one page never shows two date styles", () => {
    expect(formatCairoDate(cairoToUtc("2026-08-08", "14:30"), "ar")).toBe("8 أغسطس 2026");
  });
});

describe("formatCairoShort — the lead chat's stamp, no longer its own clock", () => {
  it("day, month and a twelve-hour time, in both languages", () => {
    const at = cairoToUtc("2026-08-20", "14:30");
    expect(formatCairoShort(at, "en")).toBe("20 Aug, 2:30 PM");
    expect(formatCairoShort(at, "ar")).toBe("20 أغسطس، 2:30 م");
  });
});

/* THE GUARD FOR THE ONE CATASTROPHIC EDIT. `wallClockParts` in the same file
   keeps hour12:false because it is STORAGE — flip it and cairoToUtc's offset
   solver reads "12" at midnight, `% 24` cannot correct it, and every
   midnight-hour write lands twelve hours wrong with a green typecheck. These
   assertions go red the instant anyone "finishes the job". */
describe("the wire layer stayed 24-hour (ADR-068 prohibition)", () => {
  it.each(["00:00", "00:30", "09:00", "12:00", "14:30", "23:59"])(
    "round-trips %s unchanged, in HH:mm",
    (time) => {
      const at = cairoToUtc("2026-08-20", time);
      expect(utcToCairo(at)).toEqual({ date: "2026-08-20", time });
      expect(utcToCairo(at).time).toMatch(/^\d{2}:\d{2}$/);
    },
  );

  it("still lands the right UTC instant at both ends of the day", () => {
    // Cairo is UTC+3 in August
    expect(cairoToUtc("2026-08-20", "00:00").toISOString()).toBe("2026-08-19T21:00:00.000Z");
    expect(cairoToUtc("2026-08-20", "12:00").toISOString()).toBe("2026-08-20T09:00:00.000Z");
  });

  it("Egypt's DST jumps are untouched — the display change moved no window", () => {
    /* Spring-forward: 2026-04-24 00:00 Cairo does not exist, so the solver
       settles on 23:00 of the EVE — exactly the behaviour startOfCairoDay
       (todo.ts) clamps forward to keep a day window honest. If a display edit
       ever reached wallClockParts, this is the assertion that would move. */
    expect(utcToCairo(cairoToUtc("2026-04-24", "00:00"))).toEqual({
      date: "2026-04-23",
      time: "23:00",
    });
    expect(utcToCairo(cairoToUtc("2026-04-24", "09:00"))).toEqual({
      date: "2026-04-24",
      time: "09:00",
    });
    // and the autumn end of DST still resolves both sides of the fold
    expect(utcToCairo(cairoToUtc("2026-10-30", "12:00")).date).toBe("2026-10-30");
  });
});
