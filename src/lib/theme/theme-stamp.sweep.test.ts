import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   DARK MODE — THE DIRECTORY IS THE ASSERTION (the ADR-066 / 067 / 068 shape).

   The theme only works if the element the CSS keys on carries it in the FIRST
   BYTE of the document: <html data-theme="light|dark">, stamped on the
   server from the cookie. There is no top-level layout in this app (ADR-007) —
   every route group renders its own <html> — so "dark mode for the entire
   system" is exactly as true as the LEAST careful of those layouts. A new
   route group added tomorrow that forgets the stamp would silently ship a
   module that is light-only, and would flash the wrong theme if anyone ever
   "fixed" it from the client.

   So this file reads the route tree instead of trusting a reviewer:

   1. every file under src/app that RENDERS <html>, outside the landing group,
      stamps data-theme from the cookie, hands the same value to the client
      ThemeProvider, and gives the browser chrome its colour;
   2. nothing under the landing group touches the theme at all — those pages
      have their own measured design and must never go dark;
   3. the dark CSS keeps the two promises the stamp relies on: it is reached
      only through a POSITIVE data-theme match (a document with no attribute —
      the landing — can never match one), and only on SCREEN (paper is always
      light).

   Code is read through codeOf: line endings normalised (a CRLF checkout must
   not change the verdict — BUG-015's lesson) and comments stripped, so a file
   that merely MENTIONS <html> or data-theme in prose neither counts as
   rendering it nor as stamping it. Offenders are collected, never thrown on
   the first, so one bad file cannot hide the next.
   ========================================================================== */

const ROOT = process.cwd();
const APP = path.join(ROOT, "src", "app");
const LANDING = path.join(APP, "(landing)");

/* The landing pages are a separate piece of work that is NOT committed yet —
   they live only in the founder's local working tree. This file ships with the
   dark-mode change, so it must pass on a CLEAN CHECKOUT where (landing) does
   not exist. When the landing group is present the guards below are fully
   active; when it is absent there are no landing pages to keep light, so the
   property holds by construction and the "the exclusion is not silently empty"
   check has nothing to find. That is a real distinction, not a vacuous pass:
   the moment the landing pages are committed, every guard here switches on. */
const LANDING_PRESENT = existsSync(LANDING);

function filesUnder(dir: string, ext: RegExp): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full, ext));
    else if (ext.test(entry)) out.push(full);
  }
  return out;
}

/** One file's CODE — CRLF normalised, block and line comments stripped (a
    `//` preceded by a colon survives, so a URL is not eaten). */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const rel = (file: string) => path.relative(ROOT, file).split(path.sep).join("/");
const isLanding = (file: string) => file.startsWith(LANDING + path.sep);

/** JSX that renders the document element. */
const RENDERS_HTML = /<html[\s>]/;
/** The <html …> opening tag itself. */
const HTML_TAG = /<html\b[^>]*>/;

const tsx = filesUnder(APP, /\.tsx$/);
const renderers = tsx.filter((f) => RENDERS_HTML.test(codeOf(f)));
const appRenderers = renderers.filter((f) => !isLanding(f));
const landingRenderers = renderers.filter(isLanding);

describe("dark mode — every app document is stamped on the server", () => {
  it("finds the app's <html> renderers (the sweep is not silently empty)", () => {
    /* (accounting), (bsystems), (home), (vault) today. A floor, not a list:
       a NEW group must be swept, not have to register itself first. */
    expect(appRenderers.length).toBeGreaterThanOrEqual(4);
    expect(appRenderers.map(rel)).toEqual(
      expect.arrayContaining([
        "src/app/(accounting)/layout.tsx",
        "src/app/(bsystems)/layout.tsx",
        "src/app/(home)/layout.tsx",
        "src/app/(vault)/layout.tsx",
      ]),
    );
  });

  it("does not mistake a comment for a renderer", () => {
    /* the merged CRM shell names "<html>" in its prose and renders a fragment;
       if the comment stripping regressed, it would be swept as a renderer and
       every check below would start lying in one direction or the other */
    expect(appRenderers.map(rel)).not.toContain("src/app/(bsystems)/b-systems/(app)/layout.tsx");
  });

  it("stamps data-theme on <html> from an expression, never a literal", () => {
    const offenders: string[] = [];
    for (const f of appRenderers) {
      const tag = codeOf(f).match(HTML_TAG)?.[0] ?? "";
      if (!/\sdata-theme=\{/.test(tag)) offenders.push(`${rel(f)}  →  ${tag || "(no <html> tag found)"}`);
    }
    expect(
      offenders,
      "these documents render <html> without data-theme={…} — the page would be light-only, " +
        "and any client-side fix would flash (src/lib/theme)",
    ).toEqual([]);
  });

  it("reads the stamped value from the cookie (await getTheme())", () => {
    const offenders = appRenderers.filter((f) => !/\bawait\s+getTheme\s*\(\s*\)/.test(codeOf(f)));
    expect(offenders.map(rel), "data-theme must come from getTheme(), the cookie's one reader").toEqual([]);
  });

  it("hands the same value to the client ThemeProvider (the toggles' pressed state)", () => {
    const offenders = appRenderers.filter((f) => !/<ThemeProvider\s+theme=\{/.test(codeOf(f)));
    expect(
      offenders.map(rel),
      "without ThemeProvider the toggle under this layout renders the wrong pressed segment",
    ).toEqual([]);
  });

  it("gives the browser chrome its colour (generateViewport → themeViewport)", () => {
    const offenders = appRenderers.filter((f) => {
      const code = codeOf(f);
      return !/export\s+async\s+function\s+generateViewport\b/.test(code) || !/\bthemeViewport\s*\(/.test(code);
    });
    expect(offenders.map(rel), "the mobile browser chrome would stay light on a dark page").toEqual([]);
  });
});

describe("dark mode — the landing pages never go dark", () => {
  const landingFiles = LANDING_PRESENT ? filesUnder(LANDING, /\.(ts|tsx)$/) : [];

  it.skipIf(!LANDING_PRESENT)("finds the landing document shell (the exclusion is not silently empty)", () => {
    expect(landingRenderers.map(rel)).toContain("src/app/(landing)/_shell/LandingHtml.tsx");
  });

  it("no landing <html> carries data-theme", () => {
    const offenders = landingRenderers.filter((f) => /data-theme/.test(codeOf(f)));
    expect(offenders.map(rel)).toEqual([]);
  });

  it("no landing file reaches for the theme at all", () => {
    /* not the cookie, not the provider, not the toggle, not the attribute —
       the route IS the design there, as the route is the language */
    const THEME_REACH = /data-theme|@\/lib\/theme|\bgetTheme\b|\bThemeProvider\b|\bThemeToggle\b|\bthemeViewport\b/;
    const offenders = landingFiles.filter((f) => THEME_REACH.test(codeOf(f)));
    expect(offenders.map(rel)).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
   The CSS half of the contract. A deliberately small CSS reader: it walks the
   braces (skipping strings and comments) and reports every style rule with
   the chain of at-rules around it — enough to answer "is this dark rule inside
   @media screen" and "what does it select", which is all that is asked.
   --------------------------------------------------------------------------- */

type CssRule = { selectors: string[]; atRules: string[]; declarations: string[] };

function splitTopLevel(list: string): string[] {
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

function cssRules(source: string): CssRule[] {
  const css = source.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: CssRule[] = [];
  /* one frame per open block: an at-rule prelude, or the rule it opened */
  const stack: Array<{ at: string } | { rule: CssRule }> = [];
  let buf = "";
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (ch === '"' || ch === "'") {
      const end = css.indexOf(ch, i + 1);
      if (end === -1) break; // an unterminated string: stop reading, never loop
      buf += css.slice(i, end + 1);
      i = end;
      continue;
    }
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        stack.push({ at: prelude });
      } else {
        const atRules = stack.flatMap((f) => ("at" in f ? [f.at] : []));
        const rule: CssRule = { selectors: splitTopLevel(prelude), atRules, declarations: [] };
        rules.push(rule);
        stack.push({ rule });
      }
    } else if (ch === ";" || ch === "}") {
      const top = stack[stack.length - 1];
      if (top && "rule" in top && buf.trim()) top.rule.declarations.push(buf.trim());
      buf = "";
      if (ch === "}") stack.pop();
    } else buf += ch;
  }
  return rules;
}

/* Every stylesheet the APP documents load. The landing sheets are excluded
   on purpose: they are the landing's own, and the landing has no theme. */
const STYLESHEETS = [
  ...filesUnder(path.join(ROOT, "branding"), /\.css$/),
  ...filesUnder(path.join(ROOT, "src", "themes"), /\.css$/).filter(
    (f) => !path.basename(f).startsWith("landing"),
  ),
  path.join(APP, "globals.css"),
];

const DARK_MATCH = /\[\s*data-theme\s*=\s*["']?(?:dark|system)["']?\s*\]/;
const SYSTEM_MATCH = /\[\s*data-theme\s*=\s*["']?system["']?\s*\]/;
const PREFERS_DARK = /prefers-color-scheme\s*:\s*dark/;
const SCREEN_ONLY = /@media\b[^{]*\bscreen\b/;

describe("dark mode — the CSS contract the stamp relies on", () => {
  const sheets = STYLESHEETS.map((f) => ({ file: f, rules: cssRules(readFileSync(f, "utf8")) }));

  it("reads the shared stylesheets (the CSS sweep is not silently empty)", () => {
    expect(sheets.map((s) => rel(s.file))).toEqual(
      expect.arrayContaining([
        "branding/b-systems/tokens.css",
        "branding/byteforce/tokens.css",
        "src/themes/neutral.css",
        "src/themes/design-system.css",
        "src/app/globals.css",
      ]),
    );
    expect(sheets.reduce((n, s) => n + s.rules.length, 0)).toBeGreaterThan(200);
  });

  it("the reader sees through the shapes dark CSS is written in", () => {
    /* the parser's own proof — a reader that could not see a nested rule
       would pass every check below by seeing nothing */
    const probe = cssRules(`
      .a { color: red; }
      @media screen {
        :root[data-theme="dark"] [data-brand="x"], [data-theme="dark"][data-brand="x"] { --c: #000; }
        @media (prefers-color-scheme: dark) { [data-theme="system"] .b { content: "{;}"; } }
      }`);
    expect(probe.map((r) => r.selectors)).toEqual([
      [".a"],
      [':root[data-theme="dark"] [data-brand="x"]', '[data-theme="dark"][data-brand="x"]'],
      ['[data-theme="system"] .b'],
    ]);
    expect(probe[2]!.atRules).toEqual(["@media screen", "@media (prefers-color-scheme: dark)"]);
    expect(probe[2]!.declarations).toEqual(['content: "{;}"']);
  });

  it("every dark rule is SCREEN-only — paper is always light", () => {
    const offenders: string[] = [];
    for (const { file, rules } of sheets) {
      for (const r of rules) {
        const dark = r.selectors.some((s) => DARK_MATCH.test(s)) || r.atRules.some((a) => PREFERS_DARK.test(a));
        if (dark && !r.atRules.some((a) => SCREEN_ONLY.test(a))) {
          offenders.push(`${rel(file)}  →  ${r.selectors.join(", ")}`);
        }
      }
    }
    expect(
      offenders,
      "wrap these in @media screen { … } — unscoped, they also apply to print and a dark page prints dark",
    ).toEqual([]);
  });

  it("no app stylesheet answers to the OS, and none names the retired \"system\" theme", () => {
    /* founder (amending ADR-087): "remove the system theme option". The OS
       preference used to be the SYSTEM theme's input; with two themes left,
       an explicit choice is the only input — a prefers-color-scheme rule would
       turn a light page dark on a dark OS, and a data-theme="system" rule is
       dead CSS that can only drift. */
    const offenders: string[] = [];
    for (const { file, rules } of sheets) {
      for (const r of rules) {
        if (r.atRules.some((a) => PREFERS_DARK.test(a))) offenders.push(`${rel(file)}  →  @media prefers-color-scheme: ${r.selectors.join(", ")}`);
        for (const s of r.selectors) if (SYSTEM_MATCH.test(s)) offenders.push(`${rel(file)}  →  ${s}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no rule reaches dark through a NEGATIVE match (:not([data-theme…]))", () => {
    /* `:root:not([data-theme="light"])` matches a document with NO attribute —
       which is exactly what the landing pages are. A positive match is the
       only way the landing can be guaranteed never to go dark. */
    const offenders: string[] = [];
    for (const { file, rules } of sheets) {
      for (const r of rules) {
        for (const s of r.selectors) if (/:not\(\s*[^)]*data-theme/.test(s)) offenders.push(`${rel(file)}  →  ${s}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("color-scheme: dark is declared only on screen", () => {
    /* tokens are not the only colours: color-scheme switches the browser's
       OWN canvas, default text and form controls. Declared outside screen it
       would leak into print exactly the way an unscoped token would. */
    const offenders: string[] = [];
    for (const { file, rules } of sheets) {
      for (const r of rules) {
        const darkScheme = r.declarations.some((d) => /^color-scheme\s*:[^;]*\bdark\b/.test(d));
        if (darkScheme && !r.atRules.some((a) => SCREEN_ONLY.test(a))) {
          offenders.push(`${rel(file)}  →  ${r.selectors.join(", ")}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
