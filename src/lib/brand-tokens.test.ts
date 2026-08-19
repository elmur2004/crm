import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  AGENT_STAGES,
  BSYSTEMS_STAGES,
  INTERNAL_STAGES,
  PARTNER_STAGES,
} from "@/lib/pipeline-engine/constants";
import { stageAccent, stageKey, stageTint } from "@/components/bsystems/stageColors";

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

/* ADR-057 — the three-scope law, made enforceable. A stage token that lands in
   the two BRAND files but not in `src/themes/neutral.css` renders correctly
   under [data-brand="byteforce"|"bsystems"] and resolves to NOTHING under
   [data-brand="neutral"] (the `(home)` and `(vault)` shells). CI was green the
   last time that happened and production was not. */
describe("stage tokens exist in ALL THREE brand scopes (ADR-057)", () => {
  const stageNames = (css: string) => {
    const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
    const names = new Set<string>();
    for (const m of withoutComments.matchAll(/(--color-stage-[\w-]+)\s*:/g)) names.add(m[1]!);
    return [...names].sort();
  };
  const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");

  it("byteforce, b-systems and neutral declare the identical stage token set", () => {
    const bf = stageNames(read("branding/byteforce/tokens.css"));
    const bs = stageNames(read("branding/b-systems/tokens.css"));
    const neutral = stageNames(read("src/themes/neutral.css"));
    expect(bf.length).toBeGreaterThan(0);
    expect(bs).toEqual(bf);
    expect(neutral).toEqual(bf);
    /* and the new families are actually among them */
    for (const family of ["contacted", "qualified"]) {
      for (const suffix of ["", "-accent", "-chip", "-chip-ink"]) {
        expect(bf).toContain(`--color-stage-${family}${suffix}`);
      }
    }
  });

  it("every stage token is bridged into Tailwind's theme", () => {
    const globals = read("src/app/globals.css");
    for (const name of stageNames(read("branding/b-systems/tokens.css"))) {
      expect(globals).toContain(`${name}: var(${name});`);
    }
  });

  it("every stage of every pipeline resolves to a real, bound stage key", () => {
    const design = read("src/themes/design-system.css");
    const all = [
      ...INTERNAL_STAGES,
      ...PARTNER_STAGES,
      ...AGENT_STAGES,
      ...BSYSTEMS_STAGES,
    ] as readonly string[];
    for (const stage of new Set(all)) {
      const key = stageKey(stage);
      /* the helper's default is "lost" — only the Lost stage may land there,
         or a new column paints as a loss (Qualified is a WIN) */
      if (stage !== "lost") expect(key).not.toBe("lost");
      expect(design).toContain(`[data-stage-key="${key}"]`);
      expect(stageTint(stage)).toBe(`bg-stage-${key}`);
      expect(stageAccent(stage)).toBe(`bg-stage-${key}-accent`);
    }
  });
});
