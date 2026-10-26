import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   DARK MODE — the COMPONENT layer's two hand-written blocks.

   The token files carry the colours; src/themes/design-system.css carries the
   few dark rules a token cannot express on its own (the indigo header's
   active pill, board-card elevation, scrims, the ByteForce logo plate…).
   They used to exist twice — once for an explicit data-theme="dark", once
   for data-theme="system" under a dark OS. The founder removed the system
   option ("remove the system theme option", amending ADR-087), so there is
   ONE block, and this file holds it to three promises:
   1. no data-theme="system" rule remains (the twin is retired, and a pasted
      one back would be dead CSS that drifts);
   2. every rule in it is reached through a POSITIVE data-theme match on
      <html> (never a :not(), so the landing pages — which carry no
      data-theme — can never go dark), inside @media screen;
   3. they spend TOKENS only: no literal colour, ever (SPEC §4.1 — the
      branding files are the only place a brand value may live).
   ========================================================================== */

const ROOT = process.cwd();
const CSS = readFileSync(path.join(ROOT, "src", "themes", "design-system.css"), "utf8");

type Rule = { media: string; selectors: string[]; decls: string[] };

/** Flat list of style rules with the @media prelude around each (comments
    stripped, CRLF normalised, whitespace collapsed). */
function rules(source: string): Rule[] {
  const css = source.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  const stack: string[] = [];
  let buf = "";
  let current: Rule | null = null;
  let depth = 0;
  for (const ch of css) {
    if (ch === "{") {
      const prelude = buf.trim().replace(/\s+/g, " ");
      buf = "";
      if (prelude.startsWith("@")) {
        stack.push(prelude);
      } else {
        current = { media: stack.join(" | "), selectors: splitTop(prelude), decls: [] };
        out.push(current);
        depth = stack.length + 1;
      }
    } else if (ch === "}") {
      if (current && depth === stack.length + 1) {
        if (buf.trim()) current.decls.push(norm(buf));
        current = null;
      } else {
        stack.pop();
      }
      buf = "";
    } else if (ch === ";" && current) {
      if (buf.trim()) current.decls.push(norm(buf));
      buf = "";
    } else buf += ch;
  }
  return out;
}
const norm = (s: string) => s.trim().replace(/\s+/g, " ");
function splitTop(list: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const all = rules(CSS);
const DARK = all.filter((r) => r.selectors.some((s) => s.includes('[data-theme="dark"]')));
const SYSTEM = all.filter((r) => r.selectors.some((s) => s.includes('[data-theme="system"]')));

describe("design-system.css — the dark component block", () => {
  it("finds the block (the check is not silently empty), and no system twin", () => {
    expect(DARK.length).toBeGreaterThanOrEqual(8);
    expect(SYSTEM).toHaveLength(0);
    expect(CSS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/prefers-color-scheme/);
  });

  it('"dark" lives in @media screen', () => {
    for (const r of DARK) expect(r.media, r.selectors.join(", ")).toBe("@media screen");
  });

  it("every selector is a POSITIVE match on <html>'s data-theme", () => {
    for (const r of DARK) {
      for (const s of r.selectors) {
        expect(s, "must start at html[data-theme=…]").toMatch(/^html\[data-theme="dark"\]/);
        expect(s, "a negative match would reach the landing pages").not.toMatch(/:not\([^)]*data-theme/);
      }
    }
  });

  it("spends tokens only — no literal colour in any declaration", () => {
    for (const r of DARK) {
      for (const d of r.decls) {
        expect(d, r.selectors[0]).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
        expect(d, r.selectors[0]).not.toMatch(/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/);
        expect(d, r.selectors[0]).not.toMatch(/:\s*(white|black)\b/i);
      }
    }
  });

  it("every var() it spends is a semantic token or a stage var the board defines", () => {
    for (const r of DARK) {
      for (const d of r.decls) {
        for (const m of d.matchAll(/var\(\s*(--[\w-]+)/g)) {
          expect(m[1], d).toMatch(/^--(color|shadow|radius)-[\w-]+$|^--stage-(bar|well|chip|chip-ink)$/);
        }
      }
    }
  });
});
