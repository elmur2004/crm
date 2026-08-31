import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  BSYSTEMS_STAGES,
  INTERNAL_STAGES,
  PROSPECT_STAGES,
} from "@/lib/pipeline-engine/constants";
import { stageAccent, stageKey, stageTint } from "@/components/bsystems/stageColors";

/**
 * Stack smoke test + guard for ADR-001: the canonical brand token files exist
 * and carry the official palette values. Components never hardcode these —
 * this is the one place the raw hexes are allowed (plus SPEC.md and docs).
 */
const brandingDir = path.resolve(__dirname, "../../branding");

/** the declarations DIRECTLY inside one top-level rule, comments stripped.
    Block-aware on purpose: `css.includes("--token")` and a file-wide regex both
    call a token "declared" when it sits in some unrelated component rule, which
    is how `--color-acct-positive` shipped inside `.bs-mesh` instead of the
    B-Systems brand scope (reviewer finding, Run 058). */
function scopeBody(css: string, selector: string): string {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const at = withoutComments.indexOf(selector);
  if (at < 0) return "";
  const open = withoutComments.indexOf("{", at);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < withoutComments.length; i++) {
    if (withoutComments[i] === "{") depth++;
    else if (withoutComments[i] === "}") {
      depth--;
      if (depth === 0) return withoutComments.slice(open + 1, i);
    }
  }
  return "";
}

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
    // are brand-internal and excluded. Read from INSIDE the [data-brand] block
    // only: a token declared in a component rule further down the file (this is
    // exactly how --color-acct-positive* hid inside `.bs-mesh`) is invisible to
    // the brand scope and must not count as declared.
    const semanticNames = (css: string, selector: string) => {
      const names = new Set<string>();
      for (const m of scopeBody(css, selector).matchAll(
        /^\s*(--(?:color|font|gradient|radius|shadow)-[\w-]+)\s*:/gm,
      )) {
        names.add(m[1]!);
      }
      return names;
    };
    const bf = semanticNames(byteforce, '[data-brand="byteforce"]');
    const bs = semanticNames(bsystems, '[data-brand="bsystems"]');
    expect(bf.size).toBeGreaterThan(50);
    expect([...bf].sort()).toEqual([...bs].sort());
  });
});

/* ADR-057 — the three-scope law, made enforceable. A stage token that lands in
   the two BRAND files but not in `src/themes/neutral.css` renders correctly
   under [data-brand="byteforce"|"bsystems"] and resolves to NOTHING under
   [data-brand="neutral"] (the `(home)` and `(vault)` shells). CI was green the
   last time that happened and production was not. */
describe("stage tokens exist in ALL THREE brand scopes (ADR-057)", () => {
  /* SCOPE, not file (reviewer, Run 061): a stage token declared OUTSIDE its
     `[data-brand]` block resolves to nothing under that brand, and a file-wide
     scan reads it as present — exactly how `--color-acct-positive` shipped
     inside `.bs-mesh` and every guard stayed green (see the accounting-green
     test below). Both guards route through scopeBody now. */
  const stageNames = (css: string, selector: string) => {
    const names = new Set<string>();
    for (const m of scopeBody(css, selector).matchAll(/(--color-stage-[\w-]+)\s*:/g)) {
      names.add(m[1]!);
    }
    return [...names].sort();
  };
  const read = (p: string) => readFileSync(path.resolve(__dirname, "../..", p), "utf8");

  it("byteforce, b-systems and neutral declare the identical stage token set", () => {
    const bf = stageNames(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]');
    const bs = stageNames(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]');
    const neutral = stageNames(read("src/themes/neutral.css"), '[data-brand="neutral"]');
    expect(bf.length).toBeGreaterThan(0);
    expect(bs).toEqual(bf);
    expect(neutral).toEqual(bf);
    /* and the new families are actually among them */
    for (const family of ["contacted", "waiting", "qualified"]) {
      for (const suffix of ["", "-accent", "-chip", "-chip-ink"]) {
        expect(bf).toContain(`--color-stage-${family}${suffix}`);
      }
    }
  });

  /* ADR-054 addendum — the accounting green is the SAME three-scope law. It is
     the exception to R4 ("no green"), fenced to `.acct-chip--good` and
     `.row-toggle--acct-settled`, and `design-system.css` spends it through a
     bare `var()` with no fallback: a scope that does not declare the pair paints
     no green at all. The b-systems file declared it inside `.bs-mesh` from the
     day it landed and every guard was blind to it, because they all scanned the
     file rather than the SCOPE — hence scopeBody() here too. */
  it("the accounting green pair is declared in ALL THREE brand SCOPES", () => {
    const acctNames = (css: string, selector: string) => {
      const names = new Set<string>();
      for (const m of scopeBody(css, selector).matchAll(/(--color-acct-[\w-]+)\s*:/g)) {
        names.add(m[1]!);
      }
      return [...names].sort();
    };
    const bf = acctNames(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]');
    const bs = acctNames(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]');
    const neutral = acctNames(read("src/themes/neutral.css"), '[data-brand="neutral"]');
    expect(bf).toEqual(["--color-acct-positive", "--color-acct-positive-tint"]);
    expect(bs).toEqual(bf);
    expect(neutral).toEqual(bf);
    /* and identically valued in both brands (the module swaps brand per company) */
    for (const hex of ["#1B7A44", "#E6F4EC"]) {
      expect(scopeBody(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]')).toContain(hex);
      expect(scopeBody(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]')).toContain(hex);
    }
  });

  /* ADR-069 — the SECOND green exception, held to the same law as the first.
     Founder: "If it's not green right now, turn it green to signal that we did
     our due diligence and sent them WhatsApp message." Green is banned outside
     accounting by the ADR-031-Resolution R4 ruling, so this pair is its own
     named, fenced exception rather than a reuse of `--color-acct-*` — those are
     fenced BY NAME to the accounting module (the test above pins that set to
     exactly two entries, so a third `--color-acct-*` token would fail it, and
     spending them on a CRM chip would erase a fence that is doing work).

     Same VALUES as the accounting pair on purpose: the product has exactly ONE
     green, now with two fences. `.wa-sent` spends them through a bare var()
     with no fallback, so a scope that fails to declare them paints no green at
     all — which is why all three scopes are checked, not just the two brands. */
  it("the ADR-069 contact-made green is declared in ALL THREE brand SCOPES", () => {
    const contactNames = (css: string, selector: string) => {
      const names = new Set<string>();
      for (const m of scopeBody(css, selector).matchAll(/(--color-contact-made[\w-]*)\s*:/g)) {
        names.add(m[1]!);
      }
      return [...names].sort();
    };
    const bf = contactNames(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]');
    const bs = contactNames(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]');
    const neutral = contactNames(read("src/themes/neutral.css"), '[data-brand="neutral"]');
    expect(bf).toEqual(["--color-contact-made", "--color-contact-made-tint"]);
    expect(bs).toEqual(bf);
    expect(neutral).toEqual(bf);
    /* identical in both brands — the chip is the same chip whichever company
       the switch is pointed at */
    for (const hex of ["#1B7A44", "#E6F4EC"]) {
      expect(scopeBody(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]')).toContain(hex);
      expect(scopeBody(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]')).toContain(hex);
      expect(scopeBody(read("src/themes/neutral.css"), '[data-brand="neutral"]')).toContain(hex);
    }
  });

  /* And the one consumer, by name: the exception is granted to `.wa-sent` and
     nothing else, exactly as ADR-054's was granted to `.acct-chip--good` and
     `.row-toggle--acct-settled`. If a second consumer ever appears, this fails
     and whoever added it has to argue for it in an ADR rather than in a diff. */
  it("the contact-made green is spent by .wa-sent and by nothing else", () => {
    const design = read("src/themes/design-system.css").replace(/\/\*[\s\S]*?\*\//g, "");
    const rules = [...design.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) =>
      /var\(--color-contact-made/.test(m[2]!),
    );
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) {
      expect(rule[1]!.trim().startsWith(".wa-sent")).toBe(true);
    }
  });

  /* ADR-065 (brand audit) — the law says ALL THREE scopes, and until now only
     the two BRAND files were checked for the full semantic set: neutral was
     machine-checked for the stage tokens and the accounting pair, and trusted
     for everything else. A shared component that lands in the `(home)` or
     `(vault)` shell (both `[data-brand="neutral"]`) and reaches for a token
     neutral happens not to declare paints NOTHING there, with CI green — which
     is the exact shape of the two failures ADR-057 was written for. The three
     scopes are identical today (90 tokens each); this keeps them that way.

     NOT anchored to the start of a line, unlike the ADR-019 pair-check above:
     `neutral.css` declares the stage tokens several to a line, and a `^\s*`
     anchor silently sees only the first of each — which is how a probe of this
     very question first reported 33 phantom omissions. */
  it("byteforce, b-systems and neutral declare the identical FULL semantic set", () => {
    const semantic = (css: string, selector: string) =>
      [
        ...new Set(
          [...scopeBody(css, selector).matchAll(/(--(?:color|font|gradient|radius|shadow)-[\w-]+)\s*:/g)].map(
            (m) => m[1]!,
          ),
        ),
      ].sort();
    const bf = semantic(read("branding/byteforce/tokens.css"), '[data-brand="byteforce"]');
    const bs = semantic(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]');
    const neutral = semantic(read("src/themes/neutral.css"), '[data-brand="neutral"]');
    expect(bf.length).toBeGreaterThan(80);
    expect(bs).toEqual(bf);
    expect(neutral).toEqual(bf);
    /* and the ones the notifications bell spends are really among them */
    for (const name of [
      "--color-accent",
      "--color-primary-tint",
      "--color-ink-soft",
      "--color-hairline",
      "--color-surface-card",
      "--radius-control",
      "--font-body",
    ]) {
      expect(neutral).toContain(name);
    }
  });

  it("every stage token is bridged into Tailwind's theme", () => {
    const globals = read("src/app/globals.css");
    for (const name of stageNames(read("branding/b-systems/tokens.css"), '[data-brand="bsystems"]')) {
      expect(globals).toContain(`${name}: var(${name});`);
    }
  });

  it("every stage of every pipeline resolves to a real, bound stage key", () => {
    const design = read("src/themes/design-system.css");
    const all = [
      ...INTERNAL_STAGES,
      ...PROSPECT_STAGES,
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

  /* ADR-059 — the guard above is satisfied by ALIASING a new stage onto an
     existing key (waiting → "proposal" resolves, is not "lost", and its tint
     and accent match), which would paint the founder's holding column with the
     Sending-Proposals ramp for ever. Close that shortcut by name. */
  it("waiting has its OWN stage key — it is never aliased onto another column", () => {
    expect(stageKey("waiting")).toBe("waiting");
    for (const other of ["proposal", "following", "qualified", "won", "lost", "meeting"]) {
      expect(stageKey("waiting")).not.toBe(other);
    }
  });

  /* ADR-072 — the same shortcut, closed by name for the postpone column. It is
     the likeliest one to be aliased, because `lost` is the helper's DEFAULT: a
     `postponed` case simply left out resolves to "lost" silently and paints a
     lead that is merely paused in the colour of a lead that is gone — the exact
     confusion the column exists to end. */
  it("postponed has its OWN stage key and its own tint — never Lost's", () => {
    expect(stageKey("postponed")).toBe("postponed");
    expect(stageTint("postponed")).toBe("bg-stage-postponed");
    expect(stageAccent("postponed")).toBe("bg-stage-postponed-accent");
    for (const other of ["lost", "won", "waiting", "didnt-answer", "following"]) {
      expect(stageKey("postponed")).not.toBe(other);
    }
    /* and it is a stage BOTH internal pipelines carry, on neither of which it
       may be terminal — a column nobody can leave is Lost under another name */
    for (const stages of [INTERNAL_STAGES, BSYSTEMS_STAGES]) {
      expect(stages as readonly string[]).toContain("postponed");
    }
    expect(PROSPECT_STAGES as readonly string[]).not.toContain("postponed");
  });
});
