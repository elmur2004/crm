import { describe, expect, it } from "vitest";
import { telDigits, telHref, waHref } from "./phone-dial";

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

/* Founder: "a WhatsApp (message on WhatsApp) button on every lead next to the
   call button." wa.me needs country code + digits — no "+", no leading zero. */

describe("wa.me normalising", () => {
  it("prefixes Egypt (20) onto locally-typed Egyptian mobiles", () => {
    expect(waHref("01012345678")).toBe("https://wa.me/201012345678");
    expect(waHref("0100 123-4567")).toBe("https://wa.me/201001234567");
    expect(waHref("0112345678")).toBe("https://wa.me/20112345678"); // 10-digit shape
  });

  it("honours an explicit international prefix (+ or 00) as typed", () => {
    expect(waHref("+20 100 123 4567")).toBe("https://wa.me/201001234567");
    expect(waHref("0020 100 1234567")).toBe("https://wa.me/201001234567");
    expect(waHref("+966 50 123 4567")).toBe("https://wa.me/966501234567");
  });

  it("leaves bare country-coded digits alone", () => {
    expect(waHref("201001234567")).toBe("https://wa.me/201001234567");
  });

  it("degrades gracefully: no link rather than a wrong one", () => {
    expect(waHref("0223456789")).toBeNull(); // Cairo landline — no WhatsApp
    expect(waHref("")).toBeNull();
    expect(waHref("n/a")).toBeNull();
    expect(waHref(null)).toBeNull();
    expect(waHref(undefined)).toBeNull();
  });
});
