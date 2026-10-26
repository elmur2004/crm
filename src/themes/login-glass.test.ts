import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { login as msgs } from "@/lib/i18n/dict/auth";
import { loginGlass } from "@/lib/i18n/dict/login-glass";

/* ============================================================================
   THE GLASS SIGN-IN — its stylesheet's contract, made enforceable.

   src/themes/login.css is new, and the repo's existing sweeps only partly
   reach it: theme-stamp.sweep.test.ts reads every src/themes/*.css for the
   screen-only / positive-match rules, but the dark block's own checks
   (dark-components.test.ts) read design-system.css alone, and
   theme-tokens.test.ts reads the three token files. So this file holds
   login.css to the same promises, plus the ones only this page makes:

   1. dark mode: every themed rule is html[data-theme="dark"]-anchored,
      positive, inside @media screen — and no "system" twin remains (the
      founder removed that option: "remove the system theme option");
   2. colour comes from tokens only — no literal anywhere in the file, and
      every brand palette variable it spends exists in a branding file;
   3. motion: every animation, transition and will-change sits inside
      @media (prefers-reduced-motion: no-preference), and keyframes move only
      transform / opacity / filter;
   4. RTL: logical properties only;
   5. contrast is ARITHMETIC: the key text and boundary pairs are computed
      from the token files and login.css's own mix strengths;
   6. the components carry no colour or font, and every lg-* class they use
      has a rule;
   7. the strings: the e2e suite's accessible names are untouched, and no new
      string can collide with them.
   ========================================================================== */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const CSS = read("src/themes/login.css");

/* ---------------------------------------------------------------- parsing */

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
const STYLE_RULES = RULES.filter((r) => !inKeyframes(r));

/* ------------------------------------------------------------ colour maths */

type RGBA = { r: number; g: number; b: number; a: number };

function hex(h: string): RGBA {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((x) => x + x).join("") : s;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: 1,
  };
}
const lin = (c: number) => {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
};
const lum = (c: RGBA) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
function contrast(a: RGBA, b: RGBA): number {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}
/** `fg` (possibly translucent) composited over an opaque `bg`. */
function over(fg: RGBA, bg: RGBA): RGBA {
  const a = fg.a;
  return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
}

/** The declarations of the rule(s) whose selector list is exactly `sel`,
    inside exactly the at-rule chain `at` (top level by default — so a
    fallback or breakpoint re-declaration never leaks into the model). */
function declsOf(source: string, sel: string[], at: string[] = []): Map<string, string> {
  const hit = parse(source).filter(
    (r) =>
      r.selectors.length === sel.length &&
      r.selectors.every((s, i) => s === sel[i]) &&
      r.at.length === at.length &&
      r.at.every((a, i) => a === at[i]),
  );
  return new Map(hit.flatMap((r) => r.decls));
}

const NEUTRAL = read("src/themes/neutral.css");
const PALETTE = new Map([
  ...declsOf(read("branding/b-systems/tokens.css"), ['[data-brand="bsystems"]']),
  ...declsOf(read("branding/byteforce/tokens.css"), ['[data-brand="byteforce"]']),
]);

function env(theme: "light" | "dark"): Map<string, string> {
  const m = new Map<string, string>([...PALETTE]);
  for (const [k, v] of declsOf(NEUTRAL, ['[data-brand="neutral"]'])) m.set(k, v);
  for (const [k, v] of declsOf(CSS, [".lg-shell"])) m.set(k, v);
  if (theme === "dark") {
    for (const [k, v] of declsOf(
      NEUTRAL,
      ['html[data-theme="dark"][data-brand="neutral"]', 'html[data-theme="dark"] [data-brand="neutral"]'],
      ["@media screen"],
    )) m.set(k, v);
    for (const [k, v] of declsOf(CSS, ['html[data-theme="dark"] .lg-shell'], ["@media screen"])) m.set(k, v);
  }
  return m;
}

/** Evaluates the colour expressions login.css is written in: hex,
    `transparent`, var(), and color-mix(in srgb, …) with percentages that may
    themselves be var()s. */
function color(expr: string, e: Map<string, string>, depth = 0): RGBA {
  if (depth > 20) throw new Error(`cycle at ${expr}`);
  const x = expr.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(x)) return hex(x);
  if (x === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const v = /^var\(\s*(--[\w-]+)\s*\)$/.exec(x);
  if (v) {
    const raw = e.get(v[1]!);
    if (raw === undefined) throw new Error(`${v[1]} is not declared`);
    return color(raw, e, depth + 1);
  }
  const mix = /^color-mix\(\s*in srgb\s*,([\s\S]*)\)$/.exec(x);
  if (mix) {
    const parts = splitTop(mix[1]!).map((p) => {
      const tokens = splitTop(p, " ");
      const last = tokens[tokens.length - 1]!;
      const pct = /%$/.test(last) ? last : /^var\(/.test(last) && /%$/.test(e.get(last.slice(4, -1).trim()) ?? "") ? e.get(last.slice(4, -1).trim())! : null;
      return pct
        ? { c: color(tokens.slice(0, -1).join(" "), e, depth + 1), p: parseFloat(pct) / 100 }
        : { c: color(p, e, depth + 1), p: NaN };
    });
    const [A, B] = parts as [{ c: RGBA; p: number }, { c: RGBA; p: number }];
    const pa = Number.isNaN(A.p) ? 1 - B.p : A.p;
    const pb = Number.isNaN(B.p) ? 1 - pa : B.p;
    const a = A.c.a * pa + B.c.a * pb;
    if (a === 0) return { r: 0, g: 0, b: 0, a: 0 };
    return {
      r: (A.c.r * A.c.a * pa + B.c.r * B.c.a * pb) / a,
      g: (A.c.g * A.c.a * pa + B.c.g * B.c.a * pb) / a,
      b: (A.c.b * A.c.a * pa + B.c.b * B.c.a * pb) / a,
      a,
    };
  }
  throw new Error(`cannot evaluate colour "${x}"`);
}
const tok = (name: string, e: Map<string, string>) => color(`var(${name})`, e);
const pct = (name: string, e: Map<string, string>) => parseFloat(e.get(name)!) / 100;

/* ======================================================================== */

describe("login.css — dark mode follows the house contract", () => {
  const themed = STYLE_RULES.filter((r) => r.selectors.some((s) => s.includes("data-theme")));
  const DARK = themed.filter((r) => r.selectors.some((s) => s.includes('[data-theme="dark"]')));
  const SYSTEM = themed.filter((r) => r.selectors.some((s) => s.includes('[data-theme="system"]')));

  it("has dark rules at all (the checks below are not vacuous) — and no system twin", () => {
    expect(DARK.length).toBeGreaterThanOrEqual(2);
    expect(SYSTEM).toHaveLength(0);
  });

  it('"dark" sits in @media screen', () => {
    for (const r of DARK) expect(r.at, r.selectors.join(", ")).toEqual(["@media screen"]);
  });

  it('every themed selector is a POSITIVE match anchored on html[data-theme="dark"]', () => {
    for (const r of themed) {
      for (const s of r.selectors) {
        expect(s).toMatch(/^html\[data-theme="dark"\]/);
        expect(s).not.toMatch(/:not\([^)]*data-theme/);
      }
    }
  });

  it("nothing answers to prefers-color-scheme (the OS no longer chooses the theme)", () => {
    for (const r of STYLE_RULES) expect(r.at.some((a) => a.includes("prefers-color-scheme")), r.selectors.join(", ")).toBe(false);
  });
});

describe("login.css — colour comes from tokens only", () => {
  it("declares no literal colour anywhere (hex, rgb/hsl/lab…, named white/black)", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (/#[0-9a-f]{3,8}\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/(^|[\s,(])(white|black)\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("system colours appear only for forced-colors mode", () => {
    for (const r of RULES) {
      for (const [, v] of r.decls) {
        if (/\b(CanvasText|Canvas|ButtonBorder|ButtonText|LinkText|Highlight)\b/.test(v)) {
          expect(r.at.some((a) => a.includes("forced-colors: active"))).toBe(true);
        }
      }
    }
  });

  it("every var() is a semantic token, an lg-* local, or a palette variable that exists", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      for (const [, v] of r.decls) {
        for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) {
          const name = m[1]!;
          if (/^--(color|font|radius|shadow)-[\w-]+$/.test(name)) continue;
          if (/^--lg-[\w-]+$/.test(name)) continue;
          if (/^--(bs|bf)-[\w-]+$/.test(name) && PALETTE.has(name)) continue;
          offenders.push(name);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("Signal Pink is never spent (never a surface, never body text — not used at all)", () => {
    expect(CSS).not.toMatch(/--bs-pink/);
  });

  it("the B-Systems palette is only spent where B-Systems is re-stamped, ByteForce's where ByteForce is", () => {
    /* the elements that re-stamp data-brand in LoginGlass.tsx: the ground
       (B-Systems) and each mark's tile (its own brand) — never nested */
    const BS_SCOPED = /^\.lg-(aurora|blob|orb|tile--bsystems)\b|^html\[data-theme="dark"\] \.lg-aurora$/;
    const BF_SCOPED = /^\.lg-tile--byteforce$/;
    for (const r of STYLE_RULES) {
      for (const [, v] of r.decls) {
        if (/var\(--bs-/.test(v)) for (const s of r.selectors) expect(s, `${s}: ${v}`).toMatch(BS_SCOPED);
        if (/var\(--bf-/.test(v)) for (const s of r.selectors) expect(s, `${s}: ${v}`).toMatch(BF_SCOPED);
      }
    }
    const tsx = read("src/components/login/LoginGlass.tsx");
    expect(tsx).toMatch(/className="lg-aurora" data-brand="bsystems"/);
    expect(tsx).toMatch(/className=\{`lg-tile lg-tile--\$\{brand\}`\} data-brand=\{brand\}/);
    /* exactly those two stamps: nothing re-brands the words or the form */
    expect(tsx.match(/data-brand=/g)).toHaveLength(2);
  });

  it("ByteForce orange is not spent at all (the logo carries it)", () => {
    expect(CSS).not.toMatch(/--bf-orange/);
  });

  it("no two-hue gradient outside the ground's own wash (the CTA and heading are flat)", () => {
    /* a gradient may mix ONE hue with white light and transparency — a gloss,
       a sheen, a glow, a bubble. Only .lg-aurora (Paper into Lavender Mist;
       Indigo Deep into the neutral ink) blends two. */
    const LIGHT = new Set(["--lg-white", "--lg-rim", "--lg-spot", "--lg-cta-gloss", "--lg-c"]);
    const offenders: string[] = [];
    for (const r of STYLE_RULES) {
      if (r.selectors.every((x) => /\.lg-aurora$/.test(x))) continue;
      for (const [k, v] of r.decls) {
        if (!/gradient\(/.test(v) || k.startsWith("-webkit-mask") || k === "mask") continue;
        const hues = new Set([...v.matchAll(/var\(\s*(--[\w-]+)/g)].map((m) => m[1]!).filter((n) => !LIGHT.has(n) && !/-a$|-hi$|-rim$|-fill$|-tint$/.test(n)));
        if (hues.size > 1) offenders.push(`${r.selectors.join(", ")} { ${k}: ${[...hues].join(" + ")} }`);
      }
    }
    expect(offenders).toEqual([]);
    expect(declsOf(CSS, [".lg-submit"]).get("background")).toBe("var(--lg-cta)");
    expect(declsOf(CSS, [".lg-title"]).get("background")).toBeUndefined();
  });

  it("each mark stands on a FLAT plate of its own brand's canvas, stacked above the sheen", () => {
    expect(declsOf(CSS, [".lg-tile--byteforce"]).get("--lg-plate")).toBe("var(--bf-offwhite)");
    expect(declsOf(CSS, [".lg-tile--bsystems"]).get("--lg-plate")).toBe("var(--bs-paper)");
    const plate = declsOf(CSS, [".lg-tile-plate"]);
    expect(plate.get("background")).toBe("var(--lg-plate)");
    expect(Number(plate.get("z-index"))).toBeGreaterThan(Number(declsOf(CSS, [".lg-tile-sheen"]).get("z-index")));
    const tsx = read("src/components/login/LoginGlass.tsx");
    expect(tsx).toMatch(/<span className="lg-tile-sheen" \/>\s*<span className="lg-tile-plate">/);
  });
});

describe("login.css — motion is opt-in and cheap", () => {
  const MOTION = /^(animation|animation-[\w-]+|transition|transition-[\w-]+|will-change)$/;
  const fenced = (r: Rule) => r.at.some((a) => /prefers-reduced-motion:\s*no-preference/.test(a));

  it("every animation / transition / will-change sits inside prefers-reduced-motion: no-preference", () => {
    const offenders: string[] = [];
    for (const r of STYLE_RULES) {
      for (const [k] of r.decls) if (MOTION.test(k) && !fenced(r)) offenders.push(`${r.selectors.join(", ")} { ${k} }`);
    }
    expect(offenders).toEqual([]);
  });

  it("the fence is there and does real work (not silently empty)", () => {
    const inside = STYLE_RULES.filter(fenced).flatMap((r) => r.decls.filter(([k]) => MOTION.test(k)));
    expect(inside.length).toBeGreaterThan(25);
  });

  it("keyframes move transform, opacity and filter only", () => {
    const props = new Set(RULES.filter(inKeyframes).flatMap((r) => r.decls.map(([k]) => k)));
    expect([...props].sort()).toEqual(expect.arrayContaining(["opacity", "transform"]));
    for (const p of props) expect(["transform", "opacity", "filter"]).toContain(p);
  });

  it("the one blurred layer that fades (the CTA glow) never animates its size", () => {
    for (const r of STYLE_RULES.filter((x) => x.selectors.some((s) => s.includes("lg-cta-glow")))) {
      for (const [k, v] of r.decls) if (k === "transition") expect(v).toMatch(/^opacity\b/);
    }
  });

  it("reduced motion leaves nothing hidden: no rule outside the fence starts an element at opacity 0, except the parts that only appear in a state", () => {
    /* the sheen and the pointer light are ornaments that only exist in
       motion; the spinner and the pending arrow swap only while signing in */
    const allowed = /lg-tile-sheen|lg-spot|lg-spinner|\[data-pending\]/;
    for (const r of STYLE_RULES.filter((x) => !fenced(x))) {
      for (const [k, v] of r.decls) {
        if (k === "opacity" && v.trim() === "0") {
          for (const s of r.selectors) expect(s).toMatch(allowed);
        }
        if (k === "visibility") expect(v).not.toBe("hidden");
      }
    }
  });
});

describe("login.css — RTL: logical properties only", () => {
  it("no physical left/right properties or values", () => {
    const offenders: string[] = [];
    for (const r of RULES) {
      for (const [k, v] of r.decls) {
        if (/^(left|right|margin-(left|right)|padding-(left|right)|border-(left|right)(-[\w]+)?|(border-)?(top|bottom)-(left|right)-radius)$/.test(k)) {
          offenders.push(`${r.selectors[0]} { ${k} }`);
        }
        if (/^(text-align|float|clear)$/.test(k) && /\b(left|right)\b/.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (k === "transform-origin" && /\b(left|right)\b/.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("directional motion mirrors: Arabic flips --lg-dir and the label's origin", () => {
    const rtl = declsOf(CSS, ['[dir="rtl"] .lg-shell']);
    expect(rtl.get("--lg-dir")).toBe("-1");
    expect(rtl.get("--lg-origin")).toBe("100% 50%");
    for (const name of ["lg-badge-in", "lg-tile-sheen", "lg-shimmer"]) {
      const body = new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`).exec(CSS)?.[1] ?? "";
      expect(body, name).toContain("var(--lg-dir)");
    }
  });
});

describe("login.css — contrast is computed, not asserted (WCAG 2.1)", () => {
  const light = env("light");
  const dark = env("dark");

  /* The deepest LIGHT ground a line of text can sit on (a phone has no card,
     so the words sit straight on the ground): the wash's most-lavender stop,
     with half of the lavender blob's and half of the indigo blob's strength
     veiled over it — the blobs are centred in the corners, so text never
     meets their full strength. */
  const deepestStop = Math.max(
    ...[...CSS.matchAll(/color-mix\(in srgb, var\(--bs-lavendermist\) (\d+)%, var\(--bs-paper\)\)/g)].map((m) => Number(m[1])),
  );
  const lightGround = over(
    { ...tok("--bs-indigo", light), a: pct("--lg-indigo-a", light) / 2 },
    over(
      { ...tok("--bs-lavender", light), a: pct("--lg-lavender-a", light) / 2 },
      color(`color-mix(in srgb, var(--bs-lavendermist) ${deepestStop}%, var(--bs-paper))`, light),
    ),
  );
  /* The lightest DARK ground: Indigo Deep under half the indigo and lavender
     blobs' strength. */
  const darkGround = over(
    { ...tok("--bs-lavender", dark), a: pct("--lg-lavender-a", dark) / 2 },
    over({ ...tok("--bs-indigo", dark), a: pct("--lg-indigo-a", dark) / 2 }, tok("--bs-indigodeep", dark)),
  );

  it("the model grounds are what they claim (a broken evaluator would pass everything)", () => {
    expect(deepestStop).toBeGreaterThanOrEqual(50);
    expect(contrast(hex("#FFFFFF"), hex("#F15C24"))).toBeCloseTo(3.34, 2);
    expect(lum(lightGround)).toBeLessThan(lum(hex("#F4F1EA")));
    expect(lum(darkGround)).toBeGreaterThan(lum(hex("#0B0F3D")));
  });

  it("the CTA's words clear 4.5:1 on its colour, gloss included, in both themes", () => {
    for (const e of [light, dark]) {
      const ink = tok("--lg-cta-ink", e);
      for (const stop of ["--lg-cta"]) {
        const ground = tok(stop, e);
        expect(contrast(ink, ground), stop).toBeGreaterThanOrEqual(4.5);
        /* the gloss fades from full strength at the top edge to nothing at
           56% of the height; the 16px label's glyph tops sit at ~37%, so
           that is the most gloss any letter carries */
        const gloss = tok("--lg-cta-gloss", e);
        const atText = over({ ...gloss, a: gloss.a * (1 - 0.37 / 0.56) }, ground);
        expect(contrast(ink, atText), `${stop} under the gloss`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("the heading reads on its ground", () => {
    expect(contrast(tok("--color-heading", light), lightGround)).toBeGreaterThanOrEqual(7);
    expect(contrast(tok("--color-heading", dark), darkGround)).toBeGreaterThanOrEqual(7);
  });

  it("body, quiet and link text clear 4.5:1 straight on the ground", () => {
    for (const [name, e, ground] of [
      ["light", light, lightGround],
      ["dark", dark, darkGround],
    ] as const) {
      for (const t of ["--color-ink", "--color-ink-soft", "--lg-quiet", "--color-link"]) {
        expect(contrast(tok(t, e), ground), `${name} ${t}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("plain --color-muted would NOT have (why --lg-quiet exists)", () => {
    expect(contrast(tok("--color-muted", light), lightGround)).toBeLessThan(4.5);
  });

  it("the input boundary clears 3:1 against the ground and against its own fill (1.4.11)", () => {
    for (const [name, e, ground] of [
      ["light", light, lightGround],
      ["dark", dark, darkGround],
    ] as const) {
      const edge = over(tok("--lg-field-edge", e), ground);
      const fill = over(tok("--lg-field", e), ground);
      expect(contrast(edge, ground), `${name} edge/ground`).toBeGreaterThanOrEqual(3);
      expect(contrast(edge, fill), `${name} edge/fill`).toBeGreaterThanOrEqual(3);
      /* and what is typed, the label and the icons, on the fill */
      expect(contrast(tok("--color-ink", e), fill), `${name} value`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tok("--lg-quiet", e), fill), `${name} label`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the error reads on its glass tint", () => {
    for (const [name, e, ground] of [
      ["light", light, lightGround],
      ["dark", dark, darkGround],
    ] as const) {
      const tint = over(color("color-mix(in srgb, var(--color-danger-tint) 92%, transparent)", e), ground);
      expect(contrast(tok("--color-danger-ink", e), tint), name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("the ByteForce logo's plate is light and opaque (its tagline is near-black; never filtered)", () => {
    /* the plate is the brand's own Off-white in BOTH themes — no dark rule
       touches it — so one measurement covers both */
    const plate = tok("--bf-offwhite", light);
    expect(plate.a).toBe(1);
    expect(contrast(tok("--bf-ink", light), plate), "tagline ink").toBeGreaterThanOrEqual(7);
    expect(contrast(tok("--bf-violet", light), plate), "violet wordmark").toBeGreaterThanOrEqual(4.5);
    for (const r of STYLE_RULES.filter((x) => x.selectors.some((s) => s.includes("data-theme")))) {
      expect(r.decls.map(([k]) => k)).not.toContain("--lg-plate");
    }
  });
});

describe("the login components — no colour, no font, no dead class", () => {
  const DIR = "src/components/login";
  const files = readdirSync(path.join(ROOT, DIR)).filter((f) => f.endsWith(".tsx"));
  const sources = files.map((f) => ({ f, src: read(`${DIR}/${f}`) }));

  it("finds the components", () => {
    expect(files.sort()).toEqual(["GlassPasswordField.tsx", "GlassSubmit.tsx", "LoginAmbient.tsx", "LoginGlass.tsx"]);
  });

  it("no hex colour, no font-family, no inline style", () => {
    for (const { f, src } of sources) {
      const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
      expect(code, f).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
      expect(code, f).not.toMatch(/font-?family/i);
      expect(code, f).not.toMatch(/\sstyle=\{/);
    }
  });

  it("every lg-* class the components use has a rule in login.css", () => {
    const defined = new Set([...CSS.matchAll(/\.(lg-[\w-]+)/g)].map((m) => m[1]!));
    const used = new Set(
      sources.flatMap(({ src }) => [...src.matchAll(/(?<![\w-])lg-[a-z][\w-]*(?<!-)/g)].map((m) => m[0])),
    );
    /* template-literal stems (`lg-tile--${brand}`) and the element ids */
    for (const skip of ["lg-tile--", "lg-mark--", "lg-identifier", "lg-password"]) used.delete(skip);
    const missing = [...used].filter((c) => !defined.has(c));
    expect(missing).toEqual([]);
  });
});

describe("the strings — the suite's accessible names are untouched", () => {
  it("the four errors, the labels, the button and the heading are still dict/auth's", () => {
    const tsx = read("src/components/login/LoginGlass.tsx");
    for (const key of [
      "title", "identifierLabel", "identifierPlaceholder", "passwordLabel", "submit",
      "errPending", "errRejected", "errHealth", "errDefault", "footNew", "footLink",
    ]) {
      expect(tsx, key).toContain(`msgs.${key}`);
    }
    expect(msgs.identifierLabel.en).toBe("Email or phone");
    expect(msgs.passwordLabel.en).toBe("Password");
    expect(msgs.submit.en).toBe("Sign in");
    expect(msgs.title.en).toBe("One door, every account.");
  });

  it("no new string can make a label or button query ambiguous", () => {
    /* getByLabel / getByRole name match by case-insensitive SUBSTRING */
    const reveal = loginGlass.reveal;
    for (const needle of [msgs.passwordLabel, msgs.identifierLabel, msgs.submit]) {
      expect(reveal.en.toLowerCase()).not.toContain(needle.en.toLowerCase());
      expect(reveal.ar).not.toContain(needle.ar);
    }
  });

  it("every new string exists in both languages; brand names stay Latin", () => {
    for (const [k, m] of Object.entries(loginGlass)) {
      expect(m.en.trim(), k).not.toBe("");
      expect(m.ar.trim(), k).not.toBe("");
    }
    expect(loginGlass.tagline.ar).toContain("ByteForce × B-Systems");
  });
});
