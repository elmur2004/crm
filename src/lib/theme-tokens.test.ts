import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/* =========================================================================
   DARK MODE — the token layer's contract, made enforceable.
   Founder: "create an entire dark mode for the entire system".

   The dark theme is ADDED blocks only (the light theme must render exactly as
   before), keyed off <html data-theme="light" | "dark" | "system"> — see
   src/lib/theme/core.ts. Each of the three scopes carries:

     @media screen { html[data-theme="dark"][data-brand="X"],
                     html[data-theme="dark"] [data-brand="X"] { …dark… } }
     @media screen and (prefers-color-scheme: dark) {
                     html[data-theme="system"][data-brand="X"],
                     html[data-theme="system"] [data-brand="X"] { …same… } }

   What this file guards, and why each one is a real failure mode:
   · a LIGHT token with no DARK counterpart silently renders light-on-dark;
   · a DARK-only token resolves to nothing under the light theme;
   · the dark and the system blocks are hand-duplicated — they WILL drift;
   · a dark rule outside `@media screen` turns a printed statement dark;
   · without `color-scheme: dark` the native controls stay glaring white;
   · contrast is ARITHMETIC here, not a comment — an edit that breaks a pair
     breaks the build;
   · the brand rules bind dark mode too (B-Systems pink never a surface or
     body text, never a pure-white surface; no pure-black surface anywhere).

   Like brand-tokens.test.ts, everything is read from INSIDE the right block
   (a token declared in some other rule is invisible to the scope), comments
   stripped.
   ========================================================================= */

const ROOT = path.resolve(__dirname, "../..");
const read = (p: string) => readFileSync(path.join(ROOT, p), "utf8");

type Scope = { name: string; file: string; brand: string };
const SCOPES: Scope[] = [
  { name: "byteforce", file: "branding/byteforce/tokens.css", brand: "byteforce" },
  { name: "b-systems", file: "branding/b-systems/tokens.css", brand: "bsystems" },
  { name: "neutral", file: "src/themes/neutral.css", brand: "neutral" },
];

const DARK_MEDIA = "screen";
const SYSTEM_MEDIA = "screen and (prefers-color-scheme: dark)";

/* ---------------------------------------------------------------- parsing */

type Rule = { selectors: string[]; media: string[]; decls: Array<[string, string]> };

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");

/** Flat rule list, @media context recorded, comma groups kept together. */
function parse(css: string): Rule[] {
  const s = stripComments(css);
  const rules: Rule[] = [];
  const stack: string[] = [];
  let buf = "";
  let i = 0;
  while (i < s.length) {
    const c = s[i]!;
    if (c === "{") {
      const prelude = buf.trim().replace(/\s+/g, " ");
      buf = "";
      if (prelude.startsWith("@")) {
        stack.push(prelude.replace(/^@media\s*/, ""));
        i++;
        continue;
      }
      let depth = 1;
      let body = "";
      i++;
      while (i < s.length) {
        if (s[i] === "{") depth++;
        else if (s[i] === "}" && --depth === 0) break;
        body += s[i];
        i++;
      }
      const decls: Array<[string, string]> = [];
      let paren = 0;
      let cur = "";
      for (const ch of `${body};`) {
        if (ch === "(") paren++;
        else if (ch === ")") paren--;
        if (ch === ";" && paren === 0) {
          const t = cur.trim();
          const k = t.indexOf(":");
          if (k > 0) decls.push([t.slice(0, k).trim(), t.slice(k + 1).trim().replace(/\s+/g, " ")]);
          cur = "";
        } else cur += ch;
      }
      rules.push({
        selectors: prelude.split(",").map((x) => x.trim()).filter(Boolean),
        media: [...stack],
        decls,
      });
      i++;
      continue;
    }
    if (c === "}") {
      stack.pop();
      buf = "";
    } else if (c === ";" && buf.trim().startsWith("@")) buf = "";
    else buf += c;
    i++;
  }
  return rules;
}

const darkSelectors = (brand: string, theme: "dark" | "system") => [
  `html[data-theme="${theme}"][data-brand="${brand}"]`,
  `html[data-theme="${theme}"] [data-brand="${brand}"]`,
];

const sameSelectors = (a: string[], b: string[]) =>
  a.length === b.length && a.every((x, k) => x === b[k]);

function blocks(scope: Scope) {
  const rules = parse(read(scope.file));
  const light = rules.filter(
    (r) => r.media.length === 0 && sameSelectors(r.selectors, [`[data-brand="${scope.brand}"]`]),
  );
  const dark = rules.filter((r) => sameSelectors(r.selectors, darkSelectors(scope.brand, "dark")));
  const system = rules.filter((r) => sameSelectors(r.selectors, darkSelectors(scope.brand, "system")));
  return { rules, light, dark, system };
}

const toMap = (decls: Array<[string, string]>) => new Map(decls);

/* The semantic namespace brand-tokens.test.ts already polices (ADR-019 / -065). */
const SEMANTIC = /^--(?:color|font|gradient|radius|shadow)-[\w-]+$/;
/* Theme-invariant by design — NOT redeclared in dark, so they can never drift:
   type and shape do not change with the theme, and the hero gradient is the
   brand's fixed signature (135° / never reversed in B; the ADR-054 banner in
   ByteForce) that already sits dark under light text in both themes. */
const INVARIANT = /^--(?:font|radius)-|^--gradient-hero$/;

/* ------------------------------------------------------------ colour maths */

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((x) => x + x).join("") : h;
  const [r, g, b] = [0, 2, 4].map((k) => parseInt(full.slice(k, k + 2), 16));
  return 0.2126 * srgbToLinear(r!) + 0.7152 * srgbToLinear(g!) + 0.0722 * srgbToLinear(b!);
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** Resolve a token the way the browser does under the dark theme: the dark
    block wins for anything it declares, everything else (the raw palette —
    --bf-*, --bs-*) comes from the light block on the same element. */
function resolver(scope: Scope) {
  const { light, dark } = blocks(scope);
  const darkMap = toMap(dark[0]!.decls);
  const lightMap = toMap(light[0]!.decls);
  const resolve = (name: string, depth = 0): string => {
    if (depth > 10) throw new Error(`var() cycle at ${name}`);
    const raw = darkMap.get(name) ?? lightMap.get(name);
    if (raw === undefined) throw new Error(`${scope.name}: ${name} is not declared`);
    const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
    return ref ? resolve(ref[1]!, depth + 1) : raw;
  };
  return (token: string) => {
    const v = resolve(token);
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${scope.name}: ${token} resolves to "${v}", not a hex`);
    return v.toUpperCase();
  };
}

/* ======================================================================== */

describe("dark mode: the blocks exist, in the contracted shape", () => {
  it.each(SCOPES)("$name: one light block, one dark block, one system block", (scope) => {
    const { light, dark, system } = blocks(scope);
    expect(light, "light block").toHaveLength(1);
    expect(dark, `dark block (${darkSelectors(scope.brand, "dark").join(", ")})`).toHaveLength(1);
    expect(system, "system block").toHaveLength(1);
  });

  /* The ADR-054 law: data-brand is ALSO re-stamped on inner wrappers, so a
     block that matched only `html[...][data-brand]` would leave every
     re-branded accounting / vault module light inside a dark page. */
  it.each(SCOPES)("$name: each block matches BOTH the <html> and the inner-wrapper shape", (scope) => {
    const { dark, system } = blocks(scope);
    expect(dark[0]!.selectors).toEqual(darkSelectors(scope.brand, "dark"));
    expect(system[0]!.selectors).toEqual(darkSelectors(scope.brand, "system"));
  });
});

describe("dark mode: complete — no light-only and no dark-only token", () => {
  it.each(SCOPES)("$name: every light semantic token has a dark counterpart", (scope) => {
    const { light, dark } = blocks(scope);
    const lightNames = light[0]!.decls.map(([k]) => k).filter((k) => SEMANTIC.test(k));
    const darkNames = new Set(dark[0]!.decls.map(([k]) => k));
    expect(lightNames.length).toBeGreaterThan(90);
    const missing = lightNames.filter((k) => !INVARIANT.test(k) && !darkNames.has(k));
    expect(missing, "light tokens with NO dark value (they would render light-on-dark)").toEqual([]);
  });

  it.each(SCOPES)("$name: the dark block declares nothing the light block lacks", (scope) => {
    const { light, dark } = blocks(scope);
    const lightNames = new Set(light[0]!.decls.map(([k]) => k));
    const extra = dark[0]!.decls
      .map(([k]) => k)
      .filter((k) => k.startsWith("--") && !lightNames.has(k));
    expect(extra, "dark-only tokens resolve to NOTHING under the light theme").toEqual([]);
  });

  it.each(SCOPES)("$name: the theme-invariant tokens are NOT redeclared (they cannot drift)", (scope) => {
    const { dark } = blocks(scope);
    const redeclared = dark[0]!.decls.map(([k]) => k).filter((k) => INVARIANT.test(k));
    expect(redeclared).toEqual([]);
  });

  /* the three scopes still declare the identical set in dark, exactly as
     brand-tokens.test.ts demands of light (ADR-019 / ADR-065) */
  it("byteforce, b-systems and neutral declare the identical dark token set", () => {
    const names = SCOPES.map((s) => blocks(s).dark[0]!.decls.map(([k]) => k).sort());
    expect(names[1]).toEqual(names[0]);
    expect(names[2]).toEqual(names[0]);
  });
});

describe("dark mode: the dark and the system blocks are identical", () => {
  /* Generalised over EVERY rule that names a theme — not just the token
     blocks — so neutral.css's hub/login twins are held to it too. */
  it.each(SCOPES)("$name: every data-theme=dark rule has a byte-identical system twin", (scope) => {
    const { rules } = blocks(scope);
    const key = (r: Rule, theme: string) =>
      r.selectors.map((x) => x.replaceAll(`data-theme="${theme}"`, "data-theme=*")).join(", ");
    const dark = new Map(
      rules.filter((r) => r.selectors.some((x) => x.includes('data-theme="dark"'))).map((r) => [key(r, "dark"), r.decls]),
    );
    const system = new Map(
      rules.filter((r) => r.selectors.some((x) => x.includes('data-theme="system"'))).map((r) => [key(r, "system"), r.decls]),
    );
    expect(dark.size).toBeGreaterThan(0);
    expect([...system.keys()].sort()).toEqual([...dark.keys()].sort());
    for (const [k, decls] of dark) {
      expect(system.get(k), `system twin of ${k}`).toEqual(decls);
    }
  });
});

describe("dark mode: print is ALWAYS light", () => {
  /* The statement document page is printed and sent to clients. A dark rule
     that is not fenced to `screen` would print dark the moment a person with
     the dark toggle pressed Ctrl+P. */
  it.each(SCOPES)("$name: every rule that names a theme sits inside @media screen", (scope) => {
    const { rules } = blocks(scope);
    const themed = rules.filter((r) => r.selectors.some((x) => x.includes("data-theme")));
    expect(themed.length).toBeGreaterThan(0);
    for (const r of themed) {
      const sel = r.selectors.join(", ");
      if (sel.includes('data-theme="dark"')) expect(r.media, sel).toEqual([DARK_MEDIA]);
      else if (sel.includes('data-theme="system"')) expect(r.media, sel).toEqual([SYSTEM_MEDIA]);
      else throw new Error(`unexpected theme selector ${sel} — light is the default and needs no rule`);
    }
  });

  it.each(SCOPES)("$name: no prefers-color-scheme query without the screen guard", (scope) => {
    const media = stripComments(read(scope.file)).match(/@media[^{]*prefers-color-scheme[^{]*\{/g) ?? [];
    expect(media.length).toBeGreaterThan(0);
    for (const m of media) expect(m.replace(/\s+/g, " ")).toMatch(/^@media screen and \(prefers-color-scheme: dark\) \{$/);
  });

  /* and every theme selector is anchored on <html> — the only element the
     app layouts stamp. The landing pages never set data-theme at all, so an
     html-anchored rule can never reach them (they stay light by design). */
  it.each(SCOPES)("$name: every theme selector is anchored on html[data-theme]", (scope) => {
    for (const r of blocks(scope).rules) {
      for (const sel of r.selectors) {
        if (sel.includes("data-theme")) expect(sel, sel).toMatch(/^html\[data-theme="(dark|system)"\]/);
      }
    }
  });

  /* The landing pages are uncommitted local work, so on a clean checkout this
     file does not exist — and a missing landing layout cannot stamp a theme.
     Skipped only when absent; active the moment the landing pages land. */
  it.skipIf(!existsSync(path.join(process.cwd(), "src/app/(landing)/layout.tsx")))(
    "the landing layout never stamps a theme",
    () => {
      expect(read("src/app/(landing)/layout.tsx")).not.toContain("data-theme");
    },
  );
});

describe("dark mode: native controls go dark too", () => {
  it.each(SCOPES)("$name: color-scheme: dark in the dark AND the system block", (scope) => {
    const { dark, system } = blocks(scope);
    for (const b of [dark[0]!, system[0]!]) {
      expect(toMap(b.decls).get("color-scheme"), b.selectors.join(", ")).toBe("dark");
    }
  });
});

/* ---------------------------------------------------------------- contrast */

type Pair = [fg: string, bg: string, need: number];
const TEXT = 4.5; // WCAG 1.4.3, normal text
const UI = 3; // WCAG 1.4.11, UI boundaries / focus / state

function pairsFor(scope: Scope): Pair[] {
  const P: Pair[] = [];
  for (const bg of ["surface", "surface-card", "surface-tint"]) {
    for (const fg of ["ink", "ink-soft", "muted", "faint", "heading", "link"]) P.push([fg, bg, TEXT]);
  }
  for (const bg of ["surface", "surface-card", "primary-tint"]) P.push(["primary", bg, TEXT]);
  for (const bg of ["surface", "surface-card"]) {
    for (const fg of ["accent", "success", "warning", "danger"]) P.push([fg, bg, TEXT]);
  }
  P.push(
    ["danger", "surface-tint", TEXT],
    ["muted", "primary-tint", TEXT],
    ["ink", "primary-tint", TEXT],
    ["on-primary", "primary", TEXT],
    ["on-secondary", "secondary", TEXT],
    ["on-accent", "accent", TEXT],
    ["on-danger", "danger", TEXT],
    ["on-success", "success", TEXT],
    ["danger", "danger-tint", TEXT],
    ["danger-ink", "danger-tint", TEXT],
    ["primary-tint-ink", "primary-tint", TEXT],
    ["secondary-tint-ink", "secondary-tint", TEXT],
    ["secondary-tint-ink", "surface-tint", TEXT],
    ["toast-ink", "toast-surface", TEXT],
    ["acct-positive", "acct-positive-tint", TEXT],
    ["acct-positive", "surface-card", TEXT],
    ["contact-made", "contact-made-tint", TEXT],
    ["on-chrome", "chrome", TEXT],
    ["on-dark", "surface-dark", TEXT],
    ["border-control", "surface", UI],
    ["border-control", "surface-card", UI],
    ["focus-ring", "surface", UI],
    ["focus-ring", "surface-card", UI],
    ["focus-ring", "surface-tint", UI],
    ["danger-border-strong", "danger-tint", UI],
    /* the Home's categorical chart cap (dashboard spec §5.1): a series mark
       is a graphical object, so 3:1 on the card it is drawn on */
    ["chart-1", "surface-card", UI],
    ["chart-2", "surface-card", UI],
    ["chart-3", "surface-card", UI],
  );
  /* the B-Systems external (agent/partner) header paints the chrome text on
     --color-surface-dark */
  if (scope.brand === "bsystems") P.push(["on-chrome", "surface-dark", TEXT]);
  if (scope.brand !== "neutral") {
    for (const k of STAGE_KEYS) {
      P.push(
        [`stage-${k}-chip-ink`, `stage-${k}-chip`, TEXT], // the stage chip
        [`stage-${k}-accent`, `stage-${k}`, TEXT], // .col-title: the accent IS text on the well
        [`stage-${k}-accent`, "surface-card", TEXT], // .chip-outline on a card
      );
    }
  }
  return P;
}

const STAGE_KEYS = [
  "intake", "following", "meeting", "proposal", "negotiation", "didnt-answer", "contacted",
  "qualified", "waiting", "won", "postponed", "fallen-behind", "lost",
];

describe("dark mode: contrast is measured, not asserted (WCAG 2.1)", () => {
  /* the maths itself, against the landing sheet's published anchors — a
     broken luminance function would otherwise pass everything */
  it("the contrast function reproduces known ratios", () => {
    expect(contrast("#F15C24", "#231F20")).toBeCloseTo(4.89, 2);
    expect(contrast("#FFFFFF", "#F15C24")).toBeCloseTo(3.34, 2);
    expect(contrast("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
  });

  it.each(SCOPES)("$name: every key text / UI pair clears its threshold", (scope) => {
    const res = resolver(scope);
    const failures: string[] = [];
    const pairs = pairsFor(scope);
    expect(pairs.length).toBeGreaterThan(50);
    for (const [fg, bg, need] of pairs) {
      const a = res(`--color-${fg}`);
      const b = res(`--color-${bg}`);
      const r = contrast(a, b);
      if (r < need) failures.push(`${fg} ${a} on ${bg} ${b} = ${r.toFixed(2)}:1 (needs ${need}:1)`);
    }
    expect(failures).toEqual([]);
  });

  /* ByteForce's orange law, by name: whatever sits on orange is INK, because
     white on orange is 3.34:1 (the landing ledger's own finding). */
  it("byteforce: what reads on orange is ink, not white", () => {
    const res = resolver(SCOPES[0]!);
    expect(res("--color-primary")).toBe("#F15C24");
    expect(res("--color-on-primary")).toBe("#231F20");
    expect(res("--color-on-accent")).toBe("#231F20");
  });

  /* B-Systems: the deliberate promotion. Systems Indigo on Indigo Deep is
     1.41:1, so primary actions move to the brand's own Process Lavender. */
  it("b-systems: primary is Process Lavender, on Indigo Deep", () => {
    const res = resolver(SCOPES[1]!);
    expect(res("--color-primary")).toBe("#D4ADFC");
    expect(res("--color-surface")).toBe("#0B0F3D");
    expect(contrast("#1D267D", "#0B0F3D")).toBeLessThan(1.5); // why: indigo would vanish
    /* and the header keeps the 60% anchor */
    expect(res("--color-chrome")).toBe("#1D267D");
  });
});

/* ------------------------------------------------------------ brand rules */

/* surfaces = anything painted as a ground; body text = anything painted as
   running text. Stage wells and chips are grounds too. */
const SURFACES = [
  "surface", "surface-card", "surface-tint", "surface-dark", "chrome", "toast-surface",
  "primary-tint", "secondary-tint", "danger-tint", "acct-positive-tint", "contact-made-tint",
  ...STAGE_KEYS.flatMap((k) => [`stage-${k}`, `stage-${k}-chip`]),
];
const BODY_TEXT = [
  "ink", "ink-soft", "muted", "faint", "heading", "link", "on-chrome",
  "primary-tint-ink", "secondary-tint-ink", "danger-ink", "toast-ink",
];

describe("dark mode: the brand rules bind dark too", () => {
  it("b-systems: Signal Pink is never a surface and never body text", () => {
    const res = resolver(SCOPES[1]!);
    expect(res("--color-accent")).toBe("#FF4F87"); // it is still the cue…
    for (const t of [...SURFACES, ...BODY_TEXT]) {
      expect(res(`--color-${t}`), `--color-${t}`).not.toBe("#FF4F87"); // …and nothing else
    }
  });

  it("b-systems: no pure #FFFFFF surface", () => {
    const res = resolver(SCOPES[1]!);
    for (const t of SURFACES) expect(res(`--color-${t}`), `--color-${t}`).not.toBe("#FFFFFF");
  });

  it.each(SCOPES)("$name: no pure #000000 surface", (scope) => {
    const res = resolver(scope);
    for (const t of SURFACES) expect(res(`--color-${t}`), `--color-${t}`).not.toBe("#000000");
    /* and not a near-black that is #000 in all but name (smearing on OLED) */
    for (const t of SURFACES) expect(luminance(res(`--color-${t}`)), `--color-${t}`).toBeGreaterThan(0.002);
  });

  /* elevation is LIGHTNESS on dark: card above canvas, tint above card,
     scrim below canvas — the standard dark-mode model */
  it.each(SCOPES)("$name: raised surfaces are lighter, the scrim is darker", (scope) => {
    const res = resolver(scope);
    const L = (t: string) => luminance(res(`--color-${t}`));
    expect(L("surface-card")).toBeGreaterThan(L("surface"));
    expect(L("surface-tint")).toBeGreaterThan(L("surface-card"));
    expect(L("surface-dark")).toBeLessThan(L("surface"));
  });

  it("byteforce: success stays violet — no green (founder ruling R4)", () => {
    const res = resolver(SCOPES[0]!);
    expect(res("--color-success")).toBe(res("--color-heading"));
    const [r, g, b] = [1, 3, 5].map((k) => parseInt(res("--color-success").slice(k, k + 2), 16));
    expect(b!).toBeGreaterThan(g!); // blue-violet, not green
    expect(r!).toBeGreaterThan(g!);
  });

  /* The functional set is brand-identical in light (ADR-014 / R2, ADR-054,
     the one green of ADR-054 / ADR-069, the uniform overlay chrome), and a
     colour that changed meaning with the company switch is the thing the
     switch is least allowed to change. Same law in dark. */
  it("the functional set is identically valued in all three dark scopes", () => {
    const SHARED = [
      "danger", "on-danger", "danger-tint", "danger-border", "danger-border-strong", "danger-ink",
      "warning", "acct-positive", "acct-positive-tint", "contact-made", "contact-made-tint",
      "toast-surface", "toast-ink", "on-dark",
    ];
    const vals = SCOPES.map((s) => {
      const res = resolver(s);
      return SHARED.map((t) => res(`--color-${t}`));
    });
    expect(vals[1]).toEqual(vals[0]);
    expect(vals[2]).toEqual(vals[0]);
    /* and the one green keeps ONE value under its two names (ADR-069) */
    const res = resolver(SCOPES[0]!);
    expect(res("--color-contact-made")).toBe(res("--color-acct-positive"));
    expect(res("--color-contact-made-tint")).toBe(res("--color-acct-positive-tint"));
  });

  /* ADR-082's law, in dark: Fallen behind is the same red column in both
     brands, built on the dark functional red. */
  it("the fallen-behind family is identical in both brands and rides the dark danger red", () => {
    const [bf, bs] = [resolver(SCOPES[0]!), resolver(SCOPES[1]!)];
    for (const suffix of ["", "-accent", "-chip", "-chip-ink"]) {
      expect(bs(`--color-stage-fallen-behind${suffix}`)).toBe(bf(`--color-stage-fallen-behind${suffix}`));
    }
    expect(bf("--color-stage-fallen-behind-accent")).toBe(bf("--color-danger"));
    expect(bf("--color-stage-fallen-behind-chip-ink")).toBe(bf("--color-danger-ink"));
    /* a shade off the error tint, never literally the same token value */
    expect(bf("--color-stage-fallen-behind")).not.toBe(bf("--color-danger-tint"));
  });
});

/* ------------------------------------------- the new tokens, light values */

/* The dark theme needed five tokens the product did not have. They were ADDED
   to every light block with values equal to what their consumers paint TODAY,
   so a component switching to one changes nothing in light. Pinned here. */
describe("the dark-mode contract tokens are byte-identical to today's light paint", () => {
  const lightOf = (scope: Scope) => toMap(blocks(scope).light[0]!.decls);

  it.each(SCOPES)("$name: on-dark / focus-ring / border-control carry today's values", (scope) => {
    const m = lightOf(scope);
    expect(m.get("--color-on-dark")).toBe("#FFFFFF");
    expect(m.get("--color-on-primary")).toBe("#FFFFFF"); // what on-dark replaces on dark grounds
    expect(m.get("--color-focus-ring")).toBe("color-mix(in srgb, var(--color-primary) 45%, transparent)");
    expect(m.get("--color-border-control")).toBe("var(--color-border)");
  });

  it("globals.css paints focus with exactly that expression (or the token itself)", () => {
    const focus = /:focus-visible\s*\{([^}]*)\}/.exec(stripComments(read("src/app/globals.css")));
    expect(focus).not.toBeNull();
    const body = focus![1]!.replace(/\s+/g, " ");
    expect(
      body.includes("color-mix(in srgb, var(--color-primary) 45%, transparent)") ||
        body.includes("var(--color-focus-ring)"),
    ).toBe(true);
  });

  it("chrome / on-chrome equal each scope's current header paint", () => {
    const [bf, bs, n] = SCOPES.map(lightOf);
    /* the generic .app-header: surface-card / ink */
    for (const m of [bf!, n!]) {
      expect(m.get("--color-chrome")).toBe("var(--color-surface-card)");
      expect(m.get("--color-on-chrome")).toBe("var(--color-ink)");
    }
    /* [data-brand="bsystems"] .app-header: primary / on-primary */
    expect(bs!.get("--color-chrome")).toBe(bs!.get("--color-primary")); // var(--bs-indigo)
    expect(bs!.get("--color-on-chrome")).toBe(bs!.get("--color-on-primary")); // #FFFFFF
  });
});

/* ------------------------------------------- the Home's tokens (§5.1) */

/** The LIGHT twin of `resolver`: the light block alone. */
function lightResolver(scope: Scope) {
  const lightMap = toMap(blocks(scope).light[0]!.decls);
  const resolve = (name: string, depth = 0): string => {
    if (depth > 10) throw new Error(`var() cycle at ${name}`);
    const raw = lightMap.get(name);
    if (raw === undefined) throw new Error(`${scope.name}: ${name} is not declared`);
    const ref = /^var\(\s*(--[\w-]+)\s*\)$/.exec(raw);
    return ref ? resolve(ref[1]!, depth + 1) : raw;
  };
  return (token: string) => resolve(token).toUpperCase();
}

describe("the dashboard tokens (dashboard spec §5.1)", () => {
  it.each(SCOPES)("$name: the chart cap clears 3:1 on the card in LIGHT too", (scope) => {
    const res = lightResolver(scope);
    const card = res("--color-surface-card");
    for (const k of [1, 2, 3]) {
      const c = res(`--color-chart-${k}`);
      expect(c, `--color-chart-${k}`).toMatch(/^#[0-9A-F]{6}$/);
      expect(contrast(c, card), `${scope.name} chart-${k} ${c} on ${card}`).toBeGreaterThanOrEqual(UI);
    }
  });

  it.each(SCOPES)("$name: --radius-panel is theme-invariant (light block only)", (scope) => {
    const { light, dark, system } = blocks(scope);
    expect(toMap(light[0]!.decls).get("--radius-panel")).toMatch(/^\d+px$/);
    expect(toMap(dark[0]!.decls).has("--radius-panel")).toBe(false);
    expect(toMap(system[0]!.decls).has("--radius-panel")).toBe(false);
  });

  it("b-systems: the chart cap is never Signal Pink and never pure white or black", () => {
    for (const res of [resolver(SCOPES[1]!), lightResolver(SCOPES[1]!)]) {
      for (const k of [1, 2, 3]) {
        expect(res(`--color-chart-${k}`)).not.toBe("#FF4F87");
        expect(res(`--color-chart-${k}`)).not.toBe("#FFFFFF");
        expect(res(`--color-chart-${k}`)).not.toBe("#000000");
      }
    }
  });
});
