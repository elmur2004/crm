import { describe, expect, it } from "vitest";
import { telDigits, telHref } from "./phone-dial";

/* Founder (call sheet): the big "Call now" button must hand the dialer a
   number it can actually dial, however the team typed it in. */

describe("tel: sanitising", () => {
  it("strips spaces, dashes, dots and brackets", () => {
    expect(telDigits("0100 123-4567")).toBe("01001234567");
    expect(telDigits("(010) 012.3456")).toBe("0100123456");
    expect(telDigits(" 02 2345 6789 ")).toBe("0223456789");
  });

  it("keeps an international prefix and normalises 00 to +", () => {
    expect(telDigits("+20 100 123 4567")).toBe("+201001234567");
    expect(telDigits("0020 100 1234567")).toBe("+201001234567");
  });

  it("returns null for a number with no digits at all", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("   ")).toBeNull();
    expect(telHref("n/a")).toBeNull();
    expect(telHref(null)).toBeNull();
    expect(telHref(undefined)).toBeNull();
  });

  it("builds the href", () => {
    expect(telHref("0100 123-4567")).toBe("tel:01001234567");
    expect(telHref("+20 100 123 4567")).toBe("tel:+201001234567");
  });
});
