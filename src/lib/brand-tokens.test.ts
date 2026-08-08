import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Stack smoke test + guard for ADR-001: the canonical brand token files exist
 * and carry the official palette values. Components never hardcode these —
 * this is the one place the raw hexes are allowed (plus SPEC.md and docs).
 */
const brandingDir = path.resolve(__dirname, "../../branding");

describe("brand token files (SPEC §4)", () => {
  const byteforce = readFileSync(
    path.join(brandingDir, "byteforce/tokens.css"),
    "utf8",
  );
  const bsystems = readFileSync(
    path.join(brandingDir, "b-systems/tokens.css"),
    "utf8",
  );

  it("ByteForce tokens carry the official palette", () => {
    for (const hex of ["#F15C24", "#53449B", "#231F20", "#E6E7E8", "#F4F1EA"]) {
      expect(byteforce.toUpperCase()).toContain(hex);
    }
  });

  it("ByteForce Royal Violet is #53449B, never #4B3B9C (ADR-001)", () => {
    // The header comment may cite the superseded hex when referencing ADR-001;
    // it must never appear as an actual value.
    const withoutComments = byteforce.replace(/\/\*[\s\S]*?\*\//g, "");
    expect(withoutComments.toUpperCase()).not.toContain("#4B3B9C");
  });

  it("B-Systems tokens carry the brand three + supporting palette", () => {
    for (const hex of [
      "#1D267D",
      "#D4ADFC",
      "#FF4F87",
      "#FAFAFD",
      "#E8D4FE",
      "#0B0F3D",
    ]) {
      expect(bsystems.toUpperCase()).toContain(hex);
    }
  });

  it("token scopes match the data-brand attribute contract", () => {
    expect(byteforce).toContain('[data-brand="byteforce"]');
    expect(bsystems).toContain('[data-brand="bsystems"]');
  });

  it("both brands define the identical semantic token set (ADR-019)", () => {
    // Semantic = the names components consume; raw palette vars (--bf-*, --bs-*)
    // are brand-internal and excluded.
    const semanticNames = (css: string) => {
      const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
      const names = new Set<string>();
      for (const m of withoutComments.matchAll(
        /^\s*(--(?:color|font|gradient|radius|shadow)-[\w-]+)\s*:/gm,
      )) {
        names.add(m[1]);
      }
      return names;
    };
    const bf = semanticNames(byteforce);
    const bs = semanticNames(bsystems);
    expect([...bf].sort()).toEqual([...bs].sort());
  });
});
