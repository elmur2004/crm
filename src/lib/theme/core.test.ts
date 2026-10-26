import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  THEMES,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  parseTheme,
  themeColorFor,
} from "./core";

/* Dark mode — the cookie's reader. The cookie is user-controlled input, so the
   parser must turn ANYTHING into one of the two values the CSS keys on.

   Founder (amending ADR-087): "remove the system theme option". Two themes
   remain; the default is light, and a cookie still holding the retired
   "system" reads as light. */

describe("the theme default", () => {
  it('is "light" — what every screen looked like before dark mode', () => {
    expect(DEFAULT_THEME).toBe("light");
    expect(parseTheme(undefined)).toBe("light");
  });

  it("offers exactly two states, light first — no system option", () => {
    expect([...THEMES]).toEqual(["light", "dark"]);
    expect(THEMES as readonly string[]).not.toContain("system");
  });

  it("is a long-lived cookie named for what it holds", () => {
    expect(THEME_COOKIE).toBe("theme");
    expect(THEME_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});

describe("parseTheme", () => {
  it.each([
    ["light", "light"],
    ["dark", "dark"],
  ] as const)("keeps %s", (raw, want) => {
    expect(parseTheme(raw)).toBe(want);
  });

  it('reads a stored "system" — the retired third value — as light', () => {
    expect(parseTheme("system")).toBe("light");
    expect(parseTheme("\tSystem\n")).toBe("light");
    expect(parseTheme("SYSTEM")).toBe("light");
  });

  it("forgives case and surrounding whitespace (a hand-edited cookie)", () => {
    expect(parseTheme("Dark")).toBe("dark");
    expect(parseTheme(" LIGHT ")).toBe("light");
    expect(parseTheme(" dark\n")).toBe("dark");
  });

  it.each([
    ["absent", undefined],
    ["null", null],
    ["empty", ""],
    ["whitespace", "   "],
    ["junk", "purple"],
    ["a near miss", "darker"],
    ["an injection attempt", '"><script>alert(1)</script>'],
    ["a JSON-ish value", '{"theme":"dark"}'],
    ["a number", 1],
    ["a boolean", true],
    ["an object", { value: "dark" }],
  ])("reads %s as the default", (_label, raw) => {
    expect(parseTheme(raw)).toBe("light");
  });

  it("reads an ARRAY as the default, even one holding a valid value", () => {
    /* a cookie is one string; an array means something upstream is confused,
       and guessing which element was meant is how a bad value gets stamped */
    expect(parseTheme(["dark"])).toBe("light");
    expect(parseTheme(["light", "dark"])).toBe("light");
    expect(parseTheme([])).toBe("light");
  });
});

describe("themeColorFor — the mobile browser chrome", () => {
  const DARK = "#000001";

  it("light emits NO theme-color: the light theme changes nothing", () => {
    expect(themeColorFor("light", DARK)).toBeUndefined();
  });

  it("dark paints the chrome dark unconditionally", () => {
    expect(themeColorFor("dark", DARK)).toBe(DARK);
  });

  it("a stored system cookie gets the light chrome (no media-qualified meta)", () => {
    expect(themeColorFor(parseTheme("system"), DARK)).toBeUndefined();
  });
});
