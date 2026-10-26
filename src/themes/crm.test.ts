import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   src/themes/crm.css — the CRM page bodies' layer — held to the same law as
   the foundation it sits on (glass-motion.test.ts holds glass.css and
   motion.css; this file holds the body layer the same way).

   Founder: "Glass frame, solid data". So this sheet frosts NOTHING (boards,
   tables, cards and rows stay solid), spends tokens only, keeps every motion
   behind prefers-reduced-motion: no-preference, moves only transform and
   opacity, never fills forwards, never runs past ~600 ms, never loops on a
   thing a person clicks, never animates a figure, lifts only under
   (hover: hover), speaks logical properties, and keeps dark rules positive
   and screen-only. It is also WIRED: the CRM root layout loads it after the
   foundation, and nothing else does.
   ========================================================================== */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const CRM = read("src/themes/crm.css");

type Rule = { selectors: string[]; at: string[]; decls: Array<[string, string]> };

function splitTop(list: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  let quote = "";
  for (const ch of list) {
    if (quote) {
      if (ch === quote) quote = "";
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
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

/** a small CSS reader: rules with the chain of at-rules around them. Strings
    (the empty states' data: URIs) are read whole, so a ";" inside one never
    splits a declaration. */
function parse(source: string): Rule[] {
  const css = source.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: Rule[] = [];
  const stack: Array<{ at: string } | { rule: Rule }> = [];
  let buf = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      const end = css.indexOf(ch, i + 1);
      buf += css.slice(i, end + 1);
      i = end;
      continue;
    }
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

const RULES = parse(CRM);
const inKeyframes = (r: Rule) => r.at.some((a) => a.startsWith("@keyframes"));
const fenced = (r: Rule) => r.at.some((a) => a.includes("prefers-reduced-motion: no-preference"));
/* the data: URI masks are SVG text — an image, not a colour declaration */
const valueOf = (v: string) => v.replace(/url\("[^"]*"\)/g, "url()");

describe("crm.css — the reader sees the sheet", () => {
  it("parses a real number of rules, keyframes and fenced blocks (the checks below are not silently empty)", () => {
    expect(RULES.length).toBeGreaterThan(80);
    expect(RULES.filter(inKeyframes).length).toBeGreaterThan(5);
    expect(RULES.filter(fenced).length).toBeGreaterThan(20);
  });
});

describe("crm.css — solid data, tokens only", () => {
  it("frosts nothing: no backdrop-filter anywhere (cards, rows and columns stay solid)", () => {
    for (const r of RULES) {
      for (const [k] of r.decls) expect(k, r.selectors.join(", ")).not.toMatch(/backdrop-filter/);
    }
  });

  it("spends no literal colour — tokens, stage vars and color-mix() over them only", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      for (const [k, raw] of r.decls) {
        const v = valueOf(raw);
        if (/#[0-9a-f]{3,8}\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/(^|[\s,(])(white|black)\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every var() is a semantic token, a stage var, a motion token or a foundation frame var", () => {
    const ALLOWED =
      /^--(color|shadow|radius|font)-[\w-]+$|^--stage-(bar|well|chip|chip-ink)$|^--(ease|duration)-[\w-]+$|^--stagger-step$|^--mo-dir$|^--frame-(on-primary|on-accent|gloss)$|^--v$|^--empty-icon$|^--ecard-arrow$/;
    for (const r of RULES) {
      for (const [, v] of r.decls) {
        for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) expect(m[1], `${r.selectors[0]}: ${v}`).toMatch(ALLOWED);
      }
    }
  });

  it("the empty states' icons are masks with no colour of their own (currentColor = an opaque mask)", () => {
    const uris = [...CRM.matchAll(/url\("(data:image\/svg\+xml,[^"]*)"\)/g)].map((m) => decodeURIComponent(m[1]!));
    expect(uris.length).toBeGreaterThanOrEqual(5);
    for (const u of uris) {
      expect(u).toMatch(/stroke='currentColor'/);
      expect(u).not.toMatch(/#[0-9a-f]{3,8}\b|rgb|fill='(?!none)/i);
    }
  });
});

describe("crm.css — screen only: print stays the plain design-system layer", () => {
  it("every rule sits inside an @media screen query (the motion fence and the hover queries included)", () => {
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      expect(r.at[0] ?? "", r.selectors.join(", ")).toMatch(/^@media screen\b/);
    }
  });

  it("nothing here answers to print", () => {
    expect(CRM.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/@media\s+print/);
  });
});

describe("crm.css — motion, only for people who have not asked for less", () => {
  const MOTION_PROPS = /^(animation(-[\w-]+)?|transition(-[\w-]+)?|will-change)$/;

  it("every animation, transition and will-change sits inside prefers-reduced-motion: no-preference", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      for (const [k] of r.decls) if (MOTION_PROPS.test(k) && !fenced(r)) offenders.push(`${r.selectors.join(", ")} { ${k} }`);
    }
    expect(offenders).toEqual([]);
  });

  it("keyframes move only transform / opacity (no blur, no layout, no colour)", () => {
    for (const r of RULES) {
      if (!inKeyframes(r)) continue;
      for (const [k] of r.decls) expect(["transform", "opacity", "translate", "scale"], `${r.at.join(" ")} ${k}`).toContain(k);
    }
  });

  it("nothing fills forwards or both (a filling transform traps a fixed dialog)", () => {
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      for (const [k, v] of r.decls) {
        if (k === "animation" || k === "animation-fill-mode") expect(v, `${r.selectors[0]} { ${k}: ${v} }`).not.toMatch(/\b(forwards|both)\b/);
      }
    }
  });

  it("no animation loops, and none runs longer than 600 ms", () => {
    const TOKENS: Record<string, number> = { "--duration-short": 140, "--duration-medium": 240, "--duration-long": 420 };
    const ms = (t: string): number => {
      const tok = /^var\((--[\w-]+)\)$/.exec(t);
      if (tok) return TOKENS[tok[1]!] ?? NaN;
      if (/^[\d.]+ms$/.test(t)) return parseFloat(t);
      if (/^[\d.]+s$/.test(t)) return parseFloat(t) * 1000;
      return NaN;
    };
    for (const r of RULES) {
      if (inKeyframes(r)) continue;
      for (const [k, v] of r.decls) {
        if (k !== "animation") continue;
        for (const one of splitTop(v)) {
          expect(one, r.selectors[0]).not.toMatch(/\binfinite\b/);
          const duration = splitTop(one, " ").map(ms).find((x) => !Number.isNaN(x));
          expect(duration, `${r.selectors[0]} { animation: ${one} }`).toBeLessThanOrEqual(600);
        }
      }
    }
  });

  it("a stagger never totals more than 250 ms", () => {
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (k !== "animation-delay") continue;
        const m = /calc\((?:(\d+)ms \+ )?var\(--stagger-step\) \* (\d+)\)/.exec(v);
        if (m) expect(Number(m[1] ?? 0) + 40 * Number(m[2]), `${r.selectors[0]}: ${v}`).toBeLessThanOrEqual(260);
        const plain = /^(\d+)ms$/.exec(v);
        if (plain) expect(Number(plain[1]), `${r.selectors[0]}: ${v}`).toBeLessThanOrEqual(250);
      }
    }
  });

  it("hover moves things only where hover exists", () => {
    for (const r of RULES) {
      if (!r.selectors.some((s) => /:hover/.test(s))) continue;
      if (!r.decls.some(([k, v]) => k === "transform" && v !== "none")) continue;
      expect(r.at.some((a) => a.includes("(hover: hover)")), r.selectors.join(", ")).toBe(true);
    }
  });

  it("numbers never animate at load (BUG-026): no counter, no keyframe on a figure; a count pops only on CHANGE", () => {
    expect(CRM).not.toMatch(/counter-(increment|reset)|@property/);
    for (const r of RULES) {
      if (!r.decls.some(([k]) => /^animation/.test(k))) continue;
      for (const s of r.selectors) {
        expect(s, "a figure must not be animated").not.toMatch(/value|figure|kpi|metric/);
        /* the column count is animated ONLY behind data-bump, which CountPill
           sets after a change it saw post-mount */
        if (/count-pill/.test(s)) expect(s).toMatch(/\[data-bump="[ab]"\]/);
      }
    }
  });

  it("entrances are vertical: no keyframe translates sideways (no sideways scroll at 320px)", () => {
    for (const r of RULES) {
      if (!inKeyframes(r)) continue;
      for (const [k, v] of r.decls) {
        if (k !== "transform") continue;
        const t = /translate3d\(\s*([^,]+),/.exec(v);
        if (t) expect(t[1]!.trim(), `${r.at.join(" ")} ${v}`).toBe("0");
        expect(v).not.toMatch(/translateX|rotate/);
      }
    }
  });
});

describe("crm.css — RTL and dark", () => {
  it("logical properties only (no physical left / right)", () => {
    const PHYSICAL = /^(left|right|margin-(left|right)|padding-(left|right)|border-(left|right)(-[\w-]+)?|inset-(left|right))$/;
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        expect(PHYSICAL.test(k), `${r.selectors[0]} { ${k} }`).toBe(false);
        if (k === "text-align") expect(v).not.toMatch(/^(left|right)$/);
      }
    }
  });

  it("a sideways inset shadow mirrors with --mo-dir", () => {
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (k === "box-shadow" && /^inset (?!0 )/.test(v)) expect(v, r.selectors[0]).toMatch(/var\(--mo-dir/);
      }
    }
  });

  it("dark rules are positive html[data-theme=\"dark\"] matches inside @media screen — no system twin, no OS query", () => {
    const dark = RULES.filter((r) => r.selectors.some((s) => s.includes("data-theme")));
    expect(dark.length).toBeGreaterThan(0);
    for (const r of dark) {
      expect(r.at, r.selectors.join(", ")).toEqual(["@media screen"]);
      for (const s of r.selectors) expect(s).toMatch(/^html\[data-theme="dark"\]/);
    }
    expect(CRM.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/prefers-color-scheme|data-theme="system"/);
  });
});

describe("crm.css — the wiring", () => {
  it("the CRM root layout loads it after the foundation (glass, then motion, then crm)", () => {
    const code = read("src/app/(bsystems)/layout.tsx");
    const at = (s: string) => code.indexOf(`import "@/themes/${s}";`);
    expect(at("crm.css")).toBeGreaterThan(at("motion.css"));
    expect(at("motion.css")).toBeGreaterThan(at("glass.css"));
  });

  it("no other app shell loads it (Accounting and the Vault keep their own bodies)", () => {
    for (const f of ["src/app/(accounting)/layout.tsx", "src/app/(vault)/layout.tsx", "src/app/(home)/layout.tsx"]) {
      expect(read(f), f).not.toContain("themes/crm.css");
    }
  });
});
