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
   parser must turn ANYTHING into one of the three values the CSS keys on. */

describe("the theme default", () => {
  it('is "system" — no cookie follows the OS', () => {
    expect(DEFAULT_THEME).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });

  it("offers exactly three states, the default first", () => {
    expect([...THEMES]).toEqual(["system", "light", "dark"]);
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
    ["system", "system"],
  ] as const)("keeps %s", (raw, want) => {
    expect(parseTheme(raw)).toBe(want);
  });

  it("forgives case and surrounding whitespace (a hand-edited cookie)", () => {
    expect(parseTheme("Dark")).toBe("dark");
    expect(parseTheme(" LIGHT ")).toBe("light");
    expect(parseTheme("\tSystem\n")).toBe("system");
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
    expect(parseTheme(raw)).toBe("system");
  });

  it("reads an ARRAY as the default, even one holding a valid value", () => {
    /* a cookie is one string; an array means something upstream is confused,
       and guessing which element was meant is how a bad value gets stamped */
    expect(parseTheme(["dark"])).toBe("system");
    expect(parseTheme(["light", "dark"])).toBe("system");
    expect(parseTheme([])).toBe("system");
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

  it("system paints it dark only under a dark OS", () => {
    expect(themeColorFor("system", DARK)).toEqual([
      { media: "(prefers-color-scheme: dark)", color: DARK },
    ]);
  });
});
