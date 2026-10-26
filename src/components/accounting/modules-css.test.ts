import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* =============================================================================
   src/themes/modules.css — the glass pass over the Accounting and Data Vault
   page bodies — held to the foundation's own rules (glass-motion.test.ts reads
   only glass.css / motion.css / launcher.css, so this file reads the modules'
   sheet with the same eyes):
   tokens only · no frost at all · every motion fenced behind
   prefers-reduced-motion: no-preference · keyframes move transform / opacity
   only · nothing fills forwards · nothing one-shot runs past 600 ms · nothing
   loops · hover transforms only where hover exists · dark rules on screen only ·
   logical properties · and both module layouts load it after motion.css.
   ========================================================================== */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const CSS = read("src/themes/modules.css");

type Rule = { selectors: string[]; at: string[]; decls: Array<[string, string]> };

function splitTop(list: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === sep && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function parse(source: string): Rule[] {
  const css = source.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  const stack: Array<{ at: string } | { rule: Rule }> = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") {
      const prelude = buf.trim().replace(/\s+/g, " ");
      buf = "";
      if (prelude.startsWith("@")) stack.push({ at: prelude });
      else {
        const rule: Rule = {
          selectors: splitTop(prelude),
          at: stack.flatMap((f) => ("at" in f ? [f.at] : [])),
          decls: [],
        };
        rules.push(rule);
        stack.push({ rule });
      }
    } else if (ch === ";" || ch === "}") {
      const top = stack[stack.length - 1];
      const text = buf.trim().replace(/\s+/g, " ");
      if (top && "rule" in top && text) {
        const k = text.indexOf(":");
        if (k > 0) top.rule.decls.push([text.slice(0, k).trim(), text.slice(k + 1).trim()]);
      }
      buf = "";
      if (ch === "}") stack.pop();
    } else buf += ch;
  }
  return rules;
}

const RULES = parse(CSS);
const inKeyframes = (r: Rule) => r.at.some((a) => a.startsWith("@keyframes"));
const fenced = (r: Rule) => r.at.some((a) => a.includes("prefers-reduced-motion: no-preference"));
const INVARIANT: Record<string, number> = {
  "--duration-short": 140,
  "--duration-medium": 240,
  "--duration-long": 420,
};

describe("modules.css — the module page bodies keep the foundation's rules", () => {
  it("is real (a silent empty parse would prove nothing)", () => {
    expect(RULES.length).toBeGreaterThan(60);
    expect(RULES.some((r) => r.selectors.includes(".mod-page > *"))).toBe(true);
  });

  it("spends tokens only: no literal colour, no font family", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (/#[0-9a-f]{3,8}\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/(^|[\s,(])(white|black)\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        /* a family only ever through the brand's font token */
        if (k === "font-family" && !/^var\(--font-[\w-]+\)$/.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (k === "font" && v !== "inherit" && !/var\(--font-/.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("frosts nothing — glass on frame only, and here not even that needs a blur", () => {
    for (const r of RULES) for (const [k] of r.decls) expect(k, r.selectors.join(", ")).not.toMatch(/backdrop-filter/);
  });

  it("every animation, transition and will-change is behind prefers-reduced-motion: no-preference", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      for (const [k] of r.decls) {
        if (/^(animation(-[\w-]+)?|transition(-[\w-]+)?|will-change)$/.test(k) && !fenced(r)) {
          offenders.push(`${r.selectors.join(", ")} { ${k} }`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("keyframes move only transform and opacity", () => {
    for (const r of RULES) {
      if (!inKeyframes(r)) continue;
      for (const [k] of r.decls) expect(["transform", "opacity"], `${r.at.join(" ")} ${k}`).toContain(k);
    }
  });

  it("nothing fills forwards (a filling transform would trap the rows' fixed dialogs)", () => {
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (k === "animation" || k === "animation-fill-mode") expect(v, r.selectors.join(", ")).not.toMatch(/\b(forwards|both)\b/);
      }
    }
  });

  it("nothing loops, and no one-shot animation is longer than 600 ms", () => {
    const ms = (t: string): number => {
      const tok = /^var\((--[\w-]+)\)$/.exec(t);
      if (tok) return INVARIANT[tok[1]!] ?? NaN;
      if (/^[\d.]+ms$/.test(t)) return parseFloat(t);
      if (/^[\d.]+s$/.test(t)) return parseFloat(t) * 1000;
      return NaN;
    };
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      for (const [k, v] of r.decls) {
        if (k !== "animation") continue;
        for (const one of splitTop(v)) {
          if (one === "none") continue;
          expect(one, r.selectors[0]).not.toMatch(/\binfinite\b/);
          const duration = splitTop(one, " ").map(ms).find((x) => !Number.isNaN(x));
          expect(duration, `${r.selectors[0]} { animation: ${one} }`).toBeLessThanOrEqual(600);
        }
      }
    }
  });

  it("a hover that MOVES an element exists only where hover does", () => {
    /* (an unfenced :hover may only take something away — the static entity
       card's lit edge, which design-system.css paints on touch screens too) */
    for (const r of RULES) {
      if (!r.selectors.some((s) => /:hover/.test(s))) continue;
      const moves = r.decls.some(([k]) => k === "transform" || k === "box-shadow" || k === "background");
      if (moves) expect(r.at.some((a) => a.includes("(hover: hover)")), r.selectors.join(", ")).toBe(true);
    }
  });

  it("no figure animates at load (BUG-026): no keyframe on a value, no counter", () => {
    /* the one counter is the import rail's step number, never a figure */
    for (const r of RULES) {
      for (const [k, v] of r.decls) if (/^counter-/.test(k)) expect(v, r.selectors.join(", ")).toBe("mod-step");
    }
    for (const r of RULES) {
      if (r.selectors.some((s) => /value|figure|metric/.test(s))) {
        expect(r.decls.some(([k]) => /^animation/.test(k)), r.selectors.join(", ")).toBe(false);
      }
    }
  });

  it("dark is html[data-theme=\"dark\"], on screen only — and never the retired system twin", () => {
    const dark = RULES.filter((r) => r.selectors.some((s) => /data-theme/.test(s)));
    expect(dark.length).toBeGreaterThan(0);
    for (const r of dark) {
      for (const s of r.selectors) expect(s).toMatch(/^html\[data-theme="dark"\] /);
      expect(r.at.some((a) => /^@media screen\b/.test(a)), r.selectors.join(", ")).toBe(true);
    }
    expect(CSS).not.toMatch(/prefers-color-scheme|data-theme="system"/);
  });

  it("RTL: logical properties only", () => {
    const PHYSICAL = /^(left|right|margin-(left|right)|padding-(left|right)|border-(left|right)(-[\w-]+)?|inset-(left|right))$/;
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        expect(PHYSICAL.test(k), `${r.selectors[0]} { ${k} }`).toBe(false);
        if (k === "text-align") expect(v).not.toMatch(/^(left|right)$/);
      }
    }
  });

  it("ByteForce's hero words never sit on orange; B-Systems' signature gradient is never turned", () => {
    /* ByteForce's band runs in the reading direction (mirrored in English);
       B-Systems' keeps SPEC §4.3's 135° in both scripts; and ByteForce's flat
       colour takes no sheen */
    expect(CSS).toMatch(/\[data-brand\] \{ --acct-hero-sx: 1; --acct-hero-sheen: mod-sheen; \}/);
    expect(CSS).toMatch(
      /\[data-brand="byteforce"\] \{ --acct-hero-sx: calc\(-1 \* var\(--mo-dir, 1\)\); --acct-hero-sheen: none; \}/,
    );
    const band = RULES.find((r) => r.selectors.length === 1 && r.selectors[0] === ".acct-hero::before")!;
    expect(new Map(band.decls).get("background-image")).toBe("var(--gradient-hero)");
    expect(new Map(band.decls).get("transform")).toBe("scaleX(var(--acct-hero-sx))");
    /* the band's direction holds on paper as well — not fenced to the screen */
    expect(band.at).toEqual([]);
  });

  it.each(["src/app/(accounting)/layout.tsx", "src/app/(vault)/layout.tsx"])(
    "%s loads modules.css after the foundation's motion.css",
    (file) => {
      const code = read(file);
      const at = (s: string) => code.indexOf(`import "@/themes/${s}";`);
      expect(at("modules.css")).toBeGreaterThan(at("motion.css"));
      expect(at("motion.css")).toBeGreaterThan(-1);
    },
  );
});
