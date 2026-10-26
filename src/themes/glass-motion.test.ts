import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   THE GLASS + MOTION FOUNDATION — its contract, made enforceable.

   Founder: "the log in page is very nicely animated and designed the rest of
   the system is still not"; asked how far the glass should go: "Glass frame,
   solid data". src/themes/glass.css frosts the FRAME (headers, menus, the
   launcher, dialogs' bezels, side panels, toasts) over an ambient ground;
   src/themes/motion.css gives every screen the sign-in's motion. Both spend
   the glass + motion tokens declared in the three scope files.

   The repo's sweeps already hold the TOKEN files (brand-tokens / theme-tokens:
   every semantic token in all three scopes, light + dark — the founder
   removed the "system" theme) and every stylesheet's dark rules (theme-stamp
   sweep: screen-only, positive matches, no data-theme="system"). This file
   holds what only the foundation promises:

   1. the glass + motion tokens: present in all three scopes, the invariant
      ones identical everywhere and never redeclared per theme;
   2. the sheets: no literal colour; every var() a token, a local or a real
      palette variable; dark rules screen-only and positive; logical
      properties only;
      backdrop-filter only on the frame and only on screen;
   3. motion: every animation / transition inside prefers-reduced-motion:
      no-preference; keyframes move transform / opacity only; no filling
      animation on page content; no long animations; staggers ≤ 250 ms;
   4. CONTRAST IS ARITHMETIC: every pair of text on glass / on the ground is
      computed from the token files and the sheets' own mix strengths, in
      every scope and both themes, against a deliberately pessimistic model of
      what can pass beneath;
   5. the wiring: the four root layouts load the sheets after the design
      system; the skeletons and the ground are aria-hidden and can never be
      mistaken for a page.
   ========================================================================== */

const ROOT = process.cwd();
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");
const GLASS = read("src/themes/glass.css");
const MOTION = read("src/themes/motion.css");
const LAUNCHER = read("src/themes/launcher.css");

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

const inKeyframes = (r: Rule) => r.at.some((a) => a.startsWith("@keyframes"));
const SHEETS: Array<[string, string]> = [
  ["glass.css", GLASS],
  ["motion.css", MOTION],
];

/* ------------------------------------------------------------ the scopes */

type Scope = { name: string; file: string; brand: string };
const SCOPES: Scope[] = [
  { name: "byteforce", file: "branding/byteforce/tokens.css", brand: "byteforce" },
  { name: "b-systems", file: "branding/b-systems/tokens.css", brand: "bsystems" },
  { name: "neutral", file: "src/themes/neutral.css", brand: "neutral" },
];

function blockOf(scope: Scope, theme: "light" | "dark"): Map<string, string> {
  const rules = parse(read(scope.file));
  const sel =
    theme === "light"
      ? [`[data-brand="${scope.brand}"]`]
      : [`html[data-theme="${theme}"][data-brand="${scope.brand}"]`, `html[data-theme="${theme}"] [data-brand="${scope.brand}"]`];
  const hit = rules.filter(
    (r) =>
      !inKeyframes(r) &&
      r.selectors.length === sel.length &&
      r.selectors.every((s, i) => s === sel[i]) &&
      (theme === "light" ? r.at.length === 0 : true),
  );
  expect(hit, `${scope.name} ${theme} block`).toHaveLength(1);
  return new Map(hit[0]!.decls);
}

const GLASS_COLOR_TOKENS = [
  "--color-glass",
  "--color-glass-strong",
  "--color-glass-chrome",
  "--color-glass-edge",
  "--color-glass-highlight",
  "--color-glass-quiet",
  "--color-glow",
  "--color-ground-halo",
  "--color-ground-wash",
  "--shadow-float",
];
const INVARIANT_TOKENS: Record<string, string> = {
  "--glass-blur": "blur(18px) saturate(160%)",
  "--glass-blur-strong": "blur(28px) saturate(170%)",
  "--ease-standard": "cubic-bezier(.2, .8, .2, 1)",
  "--ease-spring": "cubic-bezier(.34, 1.4, .64, 1)",
  "--ease-exit": "cubic-bezier(.4, 0, 1, 1)",
  "--duration-short": "140ms",
  "--duration-medium": "240ms",
  "--duration-long": "420ms",
  "--stagger-step": "40ms",
};

describe("the glass + motion tokens (ADR-019 / ADR-087: all three scopes, both themes)", () => {
  it.each(SCOPES)("$name: every glass token in the light AND the dark block", (scope) => {
    for (const theme of ["light", "dark"] as const) {
      const block = blockOf(scope, theme);
      for (const token of GLASS_COLOR_TOKENS) expect(block.has(token), `${scope.name} ${theme} ${token}`).toBe(true);
    }
  });

  it.each(SCOPES)("$name: the motion / frost tokens are declared once, identically, and never per theme", (scope) => {
    const light = blockOf(scope, "light");
    for (const [token, value] of Object.entries(INVARIANT_TOKENS)) expect(light.get(token), `${scope.name} ${token}`).toBe(value);
    const dark = blockOf(scope, "dark");
    for (const token of Object.keys(INVARIANT_TOKENS)) expect(dark.has(token), `${scope.name} dark ${token}`).toBe(false);
  });

  it("the glow is the brand's own action hue in every scope (one expression)", () => {
    for (const scope of SCOPES) {
      for (const theme of ["light", "dark"] as const) {
        expect(blockOf(scope, theme).get("--color-glow")).toBe("color-mix(in srgb, var(--color-link) 24%, transparent)");
      }
    }
  });

  it("quiet text on glass is ink-soft into muted in every scope and theme (the sign-in's --lg-quiet)", () => {
    for (const scope of SCOPES) {
      for (const theme of ["light", "dark"] as const) {
        expect(blockOf(scope, theme).get("--color-glass-quiet")).toBe(
          "color-mix(in srgb, var(--color-ink-soft) 55%, var(--color-muted))",
        );
      }
    }
  });

  it("no glass token spends Signal Pink or ByteForce orange (they are cues, never light or frost)", () => {
    for (const scope of SCOPES) {
      for (const theme of ["light", "dark"] as const) {
        const block = blockOf(scope, theme);
        for (const token of GLASS_COLOR_TOKENS) {
          const v = block.get(token)!;
          expect(v, `${scope.name} ${theme} ${token}`).not.toMatch(/--bs-pink|--bf-orange|--color-accent|#FF4F87|#F15C24/i);
        }
      }
    }
  });

  it("ByteForce keeps flat colour: its corner wash is off, in both themes, and its buttons carry no gloss", () => {
    for (const theme of ["light", "dark"] as const) {
      expect(blockOf(SCOPES[0]!, theme).get("--color-ground-wash"), theme).toBe("transparent");
    }
    expect(sheetValue(GLASS, '[data-brand="byteforce"]', "--frame-gloss")).toBe("transparent");
  });
});

/* ------------------------------------------------------------ colour maths */

type RGBA = { r: number; g: number; b: number; a: number };

function hexOf(h: string): RGBA {
  const s = h.replace("#", "");
  const full = s.length === 3 ? s.split("").map((x) => x + x).join("") : s;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
    a: full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1,
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
/** a colour at `p` of its own alpha (a glow "veiled" to part strength) */
const veil = (c: RGBA, p: number): RGBA => ({ ...c, a: c.a * p });

/** Evaluates hex, transparent, var() and color-mix(in srgb, …) — the forms
    the scope files and the two sheets are written in. */
function color(expr: string, e: Map<string, string>, depth = 0): RGBA {
  if (depth > 20) throw new Error(`cycle at ${expr}`);
  const x = expr.trim();
  if (/^#[0-9a-f]{3,8}$/i.test(x)) return hexOf(x);
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
      return /%$/.test(last)
        ? { c: color(tokens.slice(0, -1).join(" "), e, depth + 1), p: parseFloat(last) / 100 }
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

/** The custom properties a scope resolves under a theme: the light block
    (palette + semantic + glass), the dark block over it. */
function env(scope: Scope, theme: "light" | "dark"): Map<string, string> {
  const m = new Map(blockOf(scope, "light"));
  if (theme === "dark") for (const [k, v] of blockOf(scope, "dark")) m.set(k, v);
  return m;
}
const tok = (name: string, e: Map<string, string>) => color(`var(${name})`, e);

/** The one local glass.css derives for the indigo header's quiet words, read
    from the sheet itself so an edit there is measured here. */
function sheetValue(source: string, selector: string, prop: string): string {
  const hit = parse(source).filter((r) => r.selectors.includes(selector) && r.decls.some(([k]) => k === prop));
  expect(hit.length, `${selector} { ${prop} }`).toBeGreaterThan(0);
  return hit[0]!.decls.find(([k]) => k === prop)![1];
}

const TEXT = 4.5;
const LARGE = 3;

type Row = [label: string, ratio: number, need: number];
const failures = (rows: Row[]) =>
  rows.filter(([, r, need]) => r < need).map(([label, r, need]) => `${label} = ${r.toFixed(2)}:1 (needs ${need}:1)`);

/* What can pass BENEATH a piece of frame glass, pessimistically: every
   surface a page paints, plus — in light — the darkest island (an Indigo Deep
   chip, an Ink hero, a dark toast) filling the whole blur radius, and — in
   dark — the lightest one (a Lavender, orange or near-white button). */
function backdrops(e: Map<string, string>, theme: "light" | "dark"): Array<[string, RGBA]> {
  const list: Array<[string, RGBA]> = [
    ["surface", tok("--color-surface", e)],
    ["surface-card", tok("--color-surface-card", e)],
    ["surface-tint", tok("--color-surface-tint", e)],
  ];
  if (theme === "light") list.push(["surface-dark", tok("--color-surface-dark", e)]);
  else list.push(["primary", tok("--color-primary", e)], ["toast-surface", tok("--color-toast-surface", e)]);
  return list;
}

const CASES = SCOPES.flatMap((scope) => (["light", "dark"] as const).map((theme) => ({ scope, theme, label: `${scope.name} ${theme}` })));

describe("contrast on glass is measured, not asserted (WCAG 2.1)", () => {
  it("the maths reproduces known ratios", () => {
    expect(contrast(hexOf("#F15C24"), hexOf("#231F20"))).toBeCloseTo(4.89, 2);
    expect(contrast(hexOf("#FFFFFF"), hexOf("#000000"))).toBeCloseTo(21, 5);
    /* and the evaluator: Systems Indigo at 88% over white */
    const e = new Map([["--x", "#1D267D"]]);
    const c = over(color("color-mix(in srgb, var(--x) 88%, transparent)", e), hexOf("#FFFFFF"));
    expect(Math.round(c.r)).toBe(56);
  });

  it.each(CASES)("$label: dense glass (the phone sheet, menus) over anything that can pass beneath", ({ scope, theme }) => {
    const e = env(scope, theme);
    const rows: Row[] = [];
    for (const [name, back] of backdrops(e, theme)) {
      const ground = over(tok("--color-glass-strong", e), back);
      for (const fg of ["--color-ink", "--color-heading", "--color-link", "--color-glass-quiet"]) {
        rows.push([`${fg} on glass-strong over ${name}`, contrast(tok(fg, e), ground), TEXT]);
      }
    }
    expect(failures(rows)).toEqual([]);
  });

  it.each(CASES)("$label: the sticky header's words over anything that can scroll beneath", ({ scope, theme }) => {
    const e = env(scope, theme);
    const rows: Row[] = [];
    const onChrome = tok("--color-on-chrome", e);
    for (const [name, back] of backdrops(e, theme)) {
      const glass = over(tok("--color-glass-chrome", e), back);
      rows.push([`on-chrome over ${name}`, contrast(onChrome, glass), TEXT]);
      if (scope.brand === "bsystems") {
        /* the indigo header: its quiet words at --hdr-quiet, and a switch
           segment on the pill's 12% wash (design-system.css) */
        const quietExpr = sheetValue(GLASS, '[data-brand="bsystems"] .app-header', "--hdr-quiet");
        const quiet = over(color(quietExpr, e), glass);
        rows.push([`hdr-quiet over ${name}`, contrast(quiet, glass), TEXT]);
        const wash = over(color("color-mix(in srgb, var(--color-on-chrome) 12%, transparent)", e), glass);
        rows.push([`segment on the pill over ${name}`, contrast(over(color(quietExpr, e), wash), wash), TEXT]);
        rows.push([`active nav (on-chrome on its 14% pill) over ${name}`, contrast(onChrome, over(color("color-mix(in srgb, var(--color-on-chrome) 14%, transparent)", e), glass)), TEXT]);
      } else {
        rows.push([`glass-quiet over ${name}`, contrast(tok("--color-glass-quiet", e), glass), TEXT]);
      }
    }
    expect(failures(rows)).toEqual([]);
  });

  it("b-systems: the agents' deep-navy header (spec R8), smoked, keeps its words", () => {
    for (const theme of ["light", "dark"] as const) {
      const e = env(SCOPES[1]!, theme);
      const smoke = color("color-mix(in srgb, var(--color-surface-dark) 90%, transparent)", e);
      for (const [name, back] of backdrops(e, theme)) {
        const glass = over(smoke, back);
        expect(contrast(tok("--color-on-chrome", e), glass), `${theme} over ${name}`).toBeGreaterThanOrEqual(TEXT);
      }
    }
  });

  it.each(CASES)("$label: thin glass over the GROUND (panels, the company switch, launcher entries)", ({ scope, theme }) => {
    const e = env(scope, theme);
    const surface = tok("--color-surface", e);
    const grounds: Array<[string, RGBA]> = [
      ["the canvas", surface],
      ["the wash", over(tok("--color-ground-wash", e), surface)],
      ["the halo", over(tok("--color-ground-halo", e), surface)],
      ["the glow", over(tok("--color-glow", e), surface)],
    ];
    const rows: Row[] = [];
    for (const [name, g] of grounds) {
      const glass = over(tok("--color-glass", e), g);
      for (const fg of ["--color-ink", "--color-heading", "--color-link", "--color-glass-quiet", "--color-ink-soft"]) {
        rows.push([`${fg} on glass over ${name}`, contrast(tok(fg, e), glass), TEXT]);
      }
    }
    expect(failures(rows)).toEqual([]);
  });

  it.each(CASES)("$label: the app ground keeps PLAIN muted text AA (no card needed between them)", ({ scope, theme }) => {
    const e = env(scope, theme);
    const surface = tok("--color-surface", e);
    const wash = over(tok("--color-ground-wash", e), surface);
    expect(contrast(tok("--color-muted", e), wash)).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(tok("--color-faint", e), wash)).toBeGreaterThanOrEqual(scope.name === "b-systems" || theme === "dark" ? TEXT : 3);
  });

  it.each(CASES)("$label: the rich ground's words (heading / ink / link / quiet) on every glow at its peak", ({ scope, theme }) => {
    const e = env(scope, theme);
    const surface = tok("--color-surface", e);
    const halo = tok("--color-ground-halo", e);
    const glow = tok("--color-glow", e);
    const grounds: Array<[string, RGBA]> = [
      ["the halo", over(halo, surface)],
      ["the glow", over(glow, surface)],
      ["the wash", over(tok("--color-ground-wash", e), surface)],
      /* where two glows cross, each veiled to 60% of its peak */
      ["halo crossing glow", over(veil(glow, 0.6), over(veil(halo, 0.6), surface))],
    ];
    const rows: Row[] = [];
    for (const [name, g] of grounds) {
      for (const fg of ["--color-heading", "--color-ink", "--color-link", "--color-glass-quiet"]) {
        rows.push([`${fg} on ${name}`, contrast(tok(fg, e), g), TEXT]);
      }
    }
    expect(failures(rows)).toEqual([]);
  });

  it.each(CASES)("$label: a frosted toast keeps its words over the lightest and the darkest page", ({ scope, theme }) => {
    const e = env(scope, theme);
    const surface = color("color-mix(in srgb, var(--color-toast-surface) 88%, transparent)", e);
    const rows: Row[] = [];
    for (const [name, back] of [...backdrops(e, theme), ["surface-dark", tok("--color-surface-dark", e)] as [string, RGBA], ["white card", hexOf("#FFFFFF")] as [string, RGBA]]) {
      rows.push([`toast-ink over ${name}`, contrast(tok("--color-toast-ink", e), over(surface, back)), TEXT]);
    }
    expect(failures(rows)).toEqual([]);
  });

  it.each(CASES)("$label: a glossed primary button keeps its words (ByteForce: Ink on orange)", ({ scope, theme }) => {
    const e = env(scope, theme);
    /* --frame-on-primary / --frame-primary-hover: read from glass.css — the
       nearest [data-brand] scope's values (ByteForce: Ink, and a LIFTED hover) */
    const frame = scope.brand === "byteforce" ? '[data-brand="byteforce"]' : "[data-brand]";
    const ink = color(sheetValue(GLASS, frame, "--frame-on-primary"), e);
    const primary = tok("--color-primary", e);
    const hover = color(sheetValue(GLASS, frame, "--frame-primary-hover"), e);
    const rows: Row[] = [];
    for (const [name, base] of [["rest", primary], ["hover", hover]] as Array<[string, RGBA]>) {
      for (const gloss of [0, 0.2, 0.24]) {
        const g = over({ ...tok("--color-on-dark", e), a: gloss }, base);
        rows.push([`${name} under a ${gloss * 100}% gloss`, contrast(ink, g), TEXT]);
      }
    }
    expect(failures(rows)).toEqual([]);
  });

  it.each(CASES)("$label: a glossed accent button keeps its words (Indigo Deep on pink, Ink on orange)", ({ scope, theme }) => {
    const e = env(scope, theme);
    const frame = scope.brand === "neutral" ? "[data-brand]" : `[data-brand="${scope.brand}"]`;
    const ink = color(sheetValue(GLASS, frame, "--frame-on-accent"), e);
    const accent = tok("--color-accent", e);
    for (const gloss of [0, 0.2]) {
      const g = over({ ...tok("--color-on-dark", e), a: gloss }, accent);
      expect(contrast(ink, g), `${gloss * 100}% gloss`).toBeGreaterThanOrEqual(TEXT);
    }
  });

  it("the header's inline-start zone (the logos) is opaque: nothing passes behind the artwork", () => {
    const bg = sheetValue(GLASS, ".app-header::before", "background");
    expect(bg).toMatch(/^linear-gradient\( var\(--hdr-dir\), var\(--hdr-ground\) 0 var\(--hdr-solid\),/);
    expect(sheetValue(GLASS, ".app-header", "--hdr-ground")).toBe("var(--color-chrome)");
    expect(parseFloat(sheetValue(GLASS, ".app-header", "--hdr-solid"))).toBeGreaterThanOrEqual(240);
  });

  it("ByteForce's frame never puts white on orange", () => {
    expect(sheetValue(GLASS, '[data-brand="byteforce"]', "--frame-on-primary")).toBe("var(--bf-ink)");
    const e = env(SCOPES[0]!, "light");
    expect(contrast(tok("--bf-ink", e), tok("--color-primary", e))).toBeGreaterThanOrEqual(TEXT);
    expect(contrast(hexOf("#FFFFFF"), tok("--color-primary", e))).toBeLessThan(TEXT); // why
  });

  it("the portal's words hold on the smoked pane at every stop of the signature gradient", () => {
    for (const theme of ["light", "dark"] as const) {
      const e = env(SCOPES[1]!, theme);
      const smoke = color("color-mix(in srgb, var(--color-surface-dark) 40%, transparent)", e);
      const eyebrow = color(sheetValue(GLASS, ".portal-eyebrow", "color"), e);
      const tagline = color(sheetValue(GLASS, ".portal-tagline", "color"), e);
      const stops = ["#0B0F3D", "#1D267D", "#4A2A8E", "#8B3A95", "#FF4F87"];
      expect(e.get("--gradient-hero")).toContain(stops.join(" 0%, ").split(" 0%, ")[0]!); // the stops are the token's
      for (const stop of stops) {
        const pane = over(smoke, hexOf(stop));
        expect(contrast(tok("--color-on-dark", e), pane), `${theme} title on ${stop}`).toBeGreaterThanOrEqual(TEXT);
        expect(contrast(over(tagline, pane), pane), `${theme} tagline on ${stop}`).toBeGreaterThanOrEqual(TEXT);
        expect(contrast(eyebrow, pane), `${theme} eyebrow on ${stop}`).toBeGreaterThanOrEqual(TEXT);
      }
      /* the one pink word inside the headline (large display text: 3:1);
         the pink end of the gradient is the CTA corner, never under it */
      for (const stop of ["#0B0F3D", "#1D267D", "#4A2A8E"]) {
        expect(contrast(tok("--color-accent", e), over(smoke, hexOf(stop))), `${theme} pink word on ${stop}`).toBeGreaterThanOrEqual(LARGE);
      }
      /* and the pink CTA reads Indigo Deep on Signal Pink */
      expect(contrast(tok("--bs-indigodeep", e), tok("--bs-pink", e))).toBeGreaterThanOrEqual(TEXT);
    }
  });
});

/* -------------------------------------------------------------- the sheets */

const LOCAL = /^--(ag|ind|hdr|gt|mo|frame|lx|app-header-h|page-pad)(-[\w-]+)?$/;
const PALETTE = new Map([
  ...blockOf(SCOPES[1]!, "light"),
  ...blockOf(SCOPES[0]!, "light"),
]);

describe("glass.css and motion.css — colour comes from tokens only", () => {
  it.each(SHEETS)("%s: no literal colour (hex, rgb/hsl/…, named white/black)", (_name, source) => {
    const offenders: string[] = [];
    for (const r of parse(source)) {
      for (const [k, v] of r.decls) {
        if (/#[0-9a-f]{3,8}\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/\b(rgba?|hsla?|hwb|lab|lch|oklab|oklch)\s*\(/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
        if (/(^|[\s,(])(white|black)\b/i.test(v)) offenders.push(`${r.selectors[0]} { ${k}: ${v} }`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(SHEETS)("%s: system colours only under forced-colors", (_name, source) => {
    for (const r of parse(source)) {
      for (const [, v] of r.decls) {
        if (/\b(CanvasText|Canvas|ButtonBorder|ButtonText|LinkText|Highlight)\b/.test(v)) {
          expect(r.at.some((a) => a.includes("forced-colors: active"))).toBe(true);
        }
      }
    }
  });

  it.each(SHEETS)("%s: every var() is a token, a declared local, or a palette variable that exists", (_name, source) => {
    const offenders: string[] = [];
    for (const r of parse(source)) {
      for (const [, v] of r.decls) {
        for (const m of v.matchAll(/var\(\s*(--[\w-]+)/g)) {
          const name = m[1]!;
          if (/^--(color|font|radius|shadow)-[\w-]+$/.test(name)) continue;
          if (name in INVARIANT_TOKENS) continue;
          if (LOCAL.test(name)) continue;
          if (/^--(bs|bf)-[\w-]+$/.test(name) && PALETTE.has(name)) continue;
          offenders.push(`${r.selectors[0]}: ${name}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a palette variable is spent only on what reads it under its own brand", () => {
    /* --bf-ink: the ByteForce scope's own Ink (the frame's text on orange);
       --bs-paper / --bf-offwhite: a logo plate's brand canvas, on a tile that
       re-stamps its brand; --bs-indigodeep: the portal's CTA (a B-Systems page) */
    const allowed = /^(\[data-brand="(byteforce|bsystems)"\]|\.glass-tile\[data-brand="(bsystems|byteforce)"\])$/;
    for (const r of parse(GLASS)) {
      for (const [, v] of r.decls) {
        if (/var\(--(bs|bf)-/.test(v)) for (const s of r.selectors) expect(s, `${s}: ${v}`).toMatch(allowed);
      }
    }
    expect(MOTION).not.toMatch(/var\(--(bs|bf)-/);
  });
});

describe("glass.css — dark mode follows the house contract", () => {
  const rules = parse(GLASS).filter((r) => !inKeyframes(r));
  const DARK = rules.filter((r) => r.selectors.some((s) => s.includes('[data-theme="dark"]')));

  it("has dark rules, and no retired system twin", () => {
    expect(DARK.length).toBeGreaterThanOrEqual(2);
    expect(rules.filter((r) => r.selectors.some((s) => s.includes('data-theme="system"')))).toEqual([]);
    expect(GLASS.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/prefers-color-scheme/);
  });

  it('"dark" in @media screen, anchored on html', () => {
    for (const r of DARK) expect(r.at, r.selectors.join(", ")).toEqual(["@media screen"]);
    for (const r of DARK) for (const s of r.selectors) expect(s).toMatch(/^html\[data-theme="dark"\]/);
  });

  it("motion.css names no theme at all (motion is theme-blind)", () => {
    expect(MOTION.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(/data-theme|prefers-color-scheme/);
  });
});

describe("glass.css — frost only on the frame, and only on screen", () => {
  /* the frame elements allowed a backdrop-filter — a handful per screen;
     never a card, a row, a column or a tile */
  const FRAME = new Set([
    ".app-header::before",
    ".nav-sheet",
    ".bell-menu",
    ".glass-menu",
    ".modal-overlay",
    ".toast",
    ".undo-btn",
    ".glass-card",
    ".gl-top .switcher",
    ".portal-card",
    ".portal-ghost",
  ]);

  it("backdrop-filter appears only on frame elements (or is switched off)", () => {
    for (const r of parse(GLASS)) {
      for (const [k, v] of r.decls) {
        if (!/backdrop-filter$/.test(k) || v === "none") continue;
        for (const s of r.selectors) expect(FRAME.has(s), `${s} { ${k}: ${v} }`).toBe(true);
      }
    }
  });

  it("every frost, and the ground, is screen-only: glass never prints", () => {
    for (const r of parse(GLASS)) {
      const frosted = r.decls.some(([k, v]) => /backdrop-filter$/.test(k) && v !== "none");
      if (frosted) expect(r.at.some((a) => /^@media screen\b/.test(a)), r.selectors.join(", ")).toBe(true);
      if (r.selectors.some((s) => s.startsWith(".app-ground") || s.startsWith(".ag-"))) {
        expect(r.at.some((a) => /^@media (screen|print)\b/.test(a)), r.selectors.join(", ")).toBe(true);
      }
    }
    expect(GLASS).toMatch(/@media print\s*\{\s*\.app-ground\s*\{\s*display:\s*none\s*!important;\s*\}\s*\}/);
  });

  it("the header's frost lives on a ::before — never on the header (it contains the fixed phone sheet)", () => {
    for (const r of parse(GLASS)) {
      if (r.selectors.some((s) => /\.app-header$/.test(s))) {
        expect(r.decls.map(([k]) => k), r.selectors.join(", ")).not.toContain("backdrop-filter");
        expect(r.decls.map(([k]) => k)).not.toContain("transform");
        expect(r.decls.map(([k]) => k)).not.toContain("filter");
      }
    }
  });

  it("RTL: logical properties only (no physical left/right)", () => {
    const PHYSICAL = /^(left|right|margin-(left|right)|padding-(left|right)|border-(left|right)(-[\w-]+)?|inset-(left|right))$/;
    for (const [name, source] of SHEETS) {
      for (const r of parse(source)) {
        for (const [k, v] of r.decls) {
          expect(PHYSICAL.test(k), `${name} ${r.selectors[0]} { ${k} }`).toBe(false);
          if (k === "text-align") expect(v).not.toMatch(/^(left|right)$/);
        }
      }
    }
  });
});

describe("motion — only for people who have not asked for less", () => {
  const MOTION_PROPS = /^(animation(-[\w-]+)?|transition(-[\w-]+)?|will-change)$/;
  const fenced = (r: Rule) => r.at.some((a) => a.includes("prefers-reduced-motion: no-preference"));

  it.each([...SHEETS, ["launcher.css", LAUNCHER] as [string, string]])(
    "%s: every animation, transition and will-change sits inside prefers-reduced-motion: no-preference",
    (name, source) => {
      const offenders: string[] = [];
      for (const r of parse(source)) {
        if (inKeyframes(r)) continue;
        for (const [k] of r.decls) if (MOTION_PROPS.test(k) && !fenced(r)) offenders.push(`${name} ${r.selectors.join(", ")} { ${k} }`);
      }
      expect(offenders).toEqual([]);
    },
  );

  it.each([...SHEETS, ["launcher.css", LAUNCHER] as [string, string]])(
    "%s: keyframes move only transform / opacity (no blur, no layout)",
    (name, source) => {
      for (const r of parse(source)) {
        if (!inKeyframes(r)) continue;
        for (const [k] of r.decls) expect(["transform", "opacity", "translate", "scale"], `${name} ${r.at.join(" ")} ${k}`).toContain(k);
      }
    },
  );

  it("nothing that moves page content fills forwards (a filling transform traps a fixed dialog)", () => {
    for (const [name, source] of [...SHEETS, ["launcher.css", LAUNCHER] as [string, string]]) {
      for (const r of parse(source)) {
        if (inKeyframes(r)) continue;
        for (const [k, v] of r.decls) {
          if (k !== "animation" && k !== "animation-fill-mode") continue;
          if (/\b(forwards|both)\b/.test(v)) {
            /* only an EXIT, on an element about to be removed */
            for (const s of r.selectors) expect(s, `${name} ${s} { ${k}: ${v} }`).toMatch(/\[data-closing\]/);
          }
        }
      }
    }
  });

  it("no one-shot animation is longer than ~600 ms, and only decorative layers loop", () => {
    const LOOPS = /^(\.sk::after|\.bell-count|\.app-ground::(before|after)|\.ag-(blob|orb)--[\w-]+)$/;
    const ms = (t: string, e: Map<string, string>): number => {
      const tok = /^var\((--[\w-]+)\)$/.exec(t);
      if (tok) return ms(e.get(tok[1]!)!, e);
      if (/ms$/.test(t)) return parseFloat(t);
      if (/s$/.test(t)) return parseFloat(t) * 1000;
      return NaN;
    };
    const e = new Map(Object.entries(INVARIANT_TOKENS));
    for (const [name, source] of [...SHEETS, ["launcher.css", LAUNCHER] as [string, string]]) {
      for (const r of parse(source)) {
        if (inKeyframes(r)) continue;
        for (const [k, v] of r.decls) {
          if (k !== "animation") continue;
          for (const one of splitTop(v)) {
            const parts = splitTop(one, " ");
            const duration = parts.map((p) => ms(p, e)).find((x) => !Number.isNaN(x));
            if (/\binfinite\b/.test(one)) {
              for (const s of r.selectors) expect(s, `${name}: only decorative layers loop (${s})`).toMatch(LOOPS);
            } else {
              expect(duration, `${name} ${r.selectors[0]} { animation: ${one} }`).toBeLessThanOrEqual(1000);
              if (!/sheen|mo-fade 1s|mo-fade \.6s/.test(one)) {
                expect(duration, `${name} ${r.selectors[0]} { animation: ${one} }`).toBeLessThanOrEqual(600);
              }
            }
          }
        }
      }
    }
  });

  it("a stagger never totals more than 250 ms (--stagger-step × at most six)", () => {
    const step = parseFloat(INVARIANT_TOKENS["--stagger-step"]!);
    for (const m of MOTION.matchAll(/calc\(var\(--stagger-step\) \* (\d+)\)/g)) {
      expect(step * Number(m[1]), m[0]).toBeLessThanOrEqual(250);
    }
    /* the launcher's tile stagger is capped at six steps of 35 ms */
    expect(LAUNCHER).toMatch(/min\(var\(--lx-i, 0\), 6\) \* 35ms/);
  });

  it("hover lifts only where hover exists", () => {
    for (const [name, source] of [...SHEETS, ["launcher.css", LAUNCHER] as [string, string]]) {
      for (const r of parse(source)) {
        if (!r.selectors.some((s) => /:hover/.test(s))) continue;
        if (!r.decls.some(([k]) => k === "transform")) continue;
        expect(r.at.some((a) => a.includes("(hover: hover)")), `${name} ${r.selectors.join(", ")}`).toBe(true);
      }
    }
  });

  it("numbers never animate at load: no counter, no keyframe on a figure (BUG-026)", () => {
    expect(MOTION).not.toMatch(/counter-(increment|reset)|@property/);
    for (const r of parse(MOTION)) {
      if (r.selectors.some((s) => /value|figure|kpi|metric/.test(s))) {
        expect(r.decls.some(([k]) => /^animation/.test(k)), r.selectors.join(", ")).toBe(false);
      }
    }
  });
});

/* -------------------------------------------------------------- the wiring */

describe("the wiring", () => {
  const LAYOUTS = [
    "src/app/(home)/layout.tsx",
    "src/app/(bsystems)/layout.tsx",
    "src/app/(accounting)/layout.tsx",
    "src/app/(vault)/layout.tsx",
  ];

  it.each(LAYOUTS)("%s loads glass.css then motion.css, after the design system", (file) => {
    const code = read(file);
    const at = (s: string) => code.indexOf(`import "@/themes/${s}";`);
    expect(at("design-system.css")).toBeGreaterThan(-1);
    expect(at("glass.css")).toBeGreaterThan(at("design-system.css"));
    expect(at("motion.css")).toBeGreaterThan(at("glass.css"));
    if (code.includes('import "@/themes/neutral.css";')) expect(at("glass.css")).toBeGreaterThan(at("neutral.css"));
  });

  it("the ground is aria-hidden and has no content a person or a test could reach", () => {
    const code = read("src/components/shared/AppGround.tsx");
    expect(code.match(/aria-hidden="true"/g)?.length).toBe(2);
    expect(code).not.toMatch(/<(a|button|h[1-6]|p)\b/);
  });

  it("the switch indicator is aria-hidden, nameless, and never runs in the sign-in's toolbar", () => {
    const code = read("src/components/shared/SwitchIndicator.tsx");
    expect(code).toMatch(/aria-hidden="true"/);
    expect(code).toMatch(/closest\("\.lg-top"\)/);
    expect(code).not.toMatch(/aria-label|role=/);
  });

  it("skeletons are built of sk-* shapes only — never a real component class, never a heading", () => {
    const code = read("src/components/shared/RouteSkeleton.tsx").replace(/\/\*[\s\S]*?\*\//g, "");
    const classes = [...code.matchAll(/className=(?:"([^"]+)"|\{`([^`]+)`\})/g)].flatMap((m) => {
      if (m[1]) return m[1].split(/\s+/);
      /* a template: its static text, plus the string literals inside ${…} */
      const t = m[2]!;
      const inner = [...t.matchAll(/\$\{([^}]*)\}/g)].flatMap((x) => [...x[1]!.matchAll(/"([^"]*)"/g)].map((q) => q[1]!));
      return [...t.replace(/\$\{[^}]*\}/g, " ").split(/\s+/), ...inner.flatMap((q) => q.split(/\s+/))];
    });
    expect(classes.length).toBeGreaterThan(10);
    for (const c of classes) {
      if (!c) continue;
      expect(c, c).toMatch(/^(sk(-[\w-]+)?|sr-only)$/);
    }
    expect(code).not.toMatch(/<h[1-6]\b|data-metric|className="[^"]*(?<![\w-])(board|table|page-head|card)(?![\w-])/);
  });

  it("every app shell shows the route skeleton on a click (RoutePending) — and no route streams through a loading.tsx", () => {
    /* A loading.tsx is a Suspense boundary: Next would stream the DOCUMENT
       through it too, and with JavaScript off the page would never reveal
       (e2e/fallen-behind.spec's no-JS paint). The skeleton is a client
       navigation's affair only. */
    for (const shell of [
      "src/app/(bsystems)/b-systems/(app)/layout.tsx",
      "src/app/(accounting)/accounting/layout.tsx",
      "src/app/(vault)/vault/layout.tsx",
    ]) {
      expect(read(shell), shell).toMatch(/<RoutePending>\{children\}<\/RoutePending>/);
    }
    /* EVERY folder under src/app (the landing excepted — it is not an app
       shell and is not this sheet's concern), not a hand-picked list: a
       loading.tsx in any section folder streams that section's documents. */
    const loadingFiles: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== "(landing)") walk(full);
        } else if (/^loading\.(tsx|ts|jsx|js)$/.test(entry)) {
          loadingFiles.push(path.relative(ROOT, full));
        }
      }
    };
    walk(path.join(ROOT, "src/app"));
    expect(loadingFiles).toEqual([]);
    const pending = read("src/components/shared/RoutePending.tsx");
    /* only a navigation to ANOTHER path; a same-path change keeps the page */
    expect(pending).toMatch(/url\.pathname === window\.location\.pathname\) return null/);
    /* never a download, never another tab, never off the app */
    expect(pending).toMatch(/hasAttribute\("download"\)/);
    expect(pending).toMatch(/a\.target && a\.target !== "_self"/);
    /* the old page steps aside without unmounting */
    expect(read("src/themes/glass.css")).toMatch(/\.route-host\[data-pending\] \{ display: none; \}/);
  });

  it("the sign-in is untouched: login.css loads only from its own component, and spends no foundation token", () => {
    const login = read("src/themes/login.css");
    expect(login).not.toMatch(/--color-glass|--glass-blur|--ease-|--duration-|--stagger-step/);
    expect(read("src/components/login/LoginGlass.tsx")).not.toMatch(/glass\.css|motion\.css|AppGround/);
  });
});
