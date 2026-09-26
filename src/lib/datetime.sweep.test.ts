import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/* ============================================================================
   ADR-068 — ONE CLOCK, AND THE DIRECTORY IS THE ASSERTION.

   Founder: "use the twelve hour timing, not the twenty four hour timing. And
   this is through the entire system." A change made centrally is only "through
   the entire system" for as long as nobody builds a second clock beside it —
   and this repo has already lived that failure: the lead chat carried its own
   Intl.DateTimeFormat, never set hour12, and so printed 24-hour in English and
   12-hour in Arabic for months. One component, two answers, no test that
   could notice.

   So the rule is structural rather than reviewed: the ONLY legal home for a
   rendered clock is src/lib/datetime.ts. A screen that wants to print a time
   calls formatCairo / formatCairoShort, or it fails this test.

   The sweep is the shape ADR-066 and ADR-067 already use (read the route
   directory, fail the file rather than trusting a reviewer's memory).

   IT IS ENFORCED TWICE, because the first draft of this file proved that a
   pattern-only rule leaks (review, Run 080). A blocklist of option names can
   only ever catch the spellings its author thought of:

     * `toLocaleDateString(d, { hour: "numeric" })` renders a real clock, and
       `toLocaleString(` is not a substring of `toLocaleDateString(` — so the
       first draft's formatter test never even fired on the exact API this
       codebase already uses.
     * `{ dateStyle: "medium", timeStyle: "short" }` renders "20 Aug 2026,
       14:30" — byte-identical to the 24-hour string this rule exists to keep
       out — while naming neither `hour` nor `hour12` nor `hourCycle`.
     * a bare `new Date(x).toLocaleString("en-GB")` renders a clock with no
       options object at all.

   So the second test is an INVENTORY rather than a pattern: the complete set
   of files under src/app and src/components that touch a date/time locale API
   must equal the list below, each with a written reason. A new one fails until
   somebody either routes it through datetime.ts or adds itself here on
   purpose — which is what "make the directory the assertion" actually buys.
   ========================================================================== */

const ROOTS = [
  path.join(process.cwd(), "src", "app"),
  path.join(process.cwd(), "src", "components"),
];

/* Any locale-formatting API that CAN render a date or a clock. `toLocaleString(`
   is in the list on purpose even though Number carries the same method name:
   on a Date it prints "20/08/2026, 14:30:00" with no options at all, so the
   ambiguity is resolved by the inventory below (which states, per file, which
   of the two overloads is meant) rather than by guessing at the receiver. */
const DATE_API = /Intl\.DateTimeFormat|toLocaleTimeString\(|toLocaleDateString\(|toLocaleString\(/;

/* The offence: a formatter that renders an HOUR. `timeStyle` is here because
   it prints a clock without ever naming one. */
const RENDERS_HOUR =
  /\bhour\s*:|\bhour12\s*:|\bhourCycle\s*:|\btimeStyle\s*:|toLocaleTimeString\(/;

/* Every file under the swept roots that is allowed to touch DATE_API at all,
   and why. Keep the reasons — they are the review. */
const ALLOWED: Array<{ file: string; kind: "number" | "date-only"; why: string }> = [
  {
    file: "src/app/(bsystems)/b-systems/(app)/page.tsx",
    kind: "date-only",
    /* ADR-068 §3 names this one as known. It is the dashboard's "Saturday, 29
       August 2026" heading: a DATE with a weekday and no clock, and
       formatCairoDate deliberately offers no weekday. It also renders ar-EG
       WITHOUT the -u-nu-latn subtag, i.e. in Arabic-Indic digits — the one
       surface that departs from the house convention, on purpose, because it
       is prose rather than a stamp beside a record. Listed here so the
       departure is visible in the suite instead of only in the ADR. */
    why: "dashboard date heading: weekday + date, no clock (ADR-068 §3)",
  },
  {
    file: "src/components/bsystems/roleForms.tsx",
    kind: "number",
    why: "Number.prototype.toLocaleString — the EGP money preview, not a date",
  },
  {
    file: "src/components/shared/AnimatedValue.tsx",
    kind: "number",
    why: "Number.prototype.toLocaleString — the count-up animation, not a date",
  },
];

function filesUnder(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...filesUnder(full));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

const rel = (f: string) => path.relative(process.cwd(), f).split(path.sep).join("/");

describe("ADR-068 — no screen builds its own clock", () => {
  const files = ROOTS.flatMap(filesUnder);

  it("finds the app and component trees (the sweep is not silently empty)", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("no page or component formats an HOUR outside src/lib/datetime.ts", () => {
    const offenders: string[] = [];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      /* A date-only formatter is dealt with by the inventory test below; the
         offence HERE is a hand-rolled CLOCK, and no allowlist exempts it. */
      if (DATE_API.test(src) && RENDERS_HOUR.test(src)) offenders.push(rel(f));
    }
    expect(
      offenders,
      "these files render a time of their own — call formatCairo / formatCairoShort " +
        "from src/lib/datetime.ts instead (ADR-068)",
    ).toEqual([]);
  });

  it("the ONLY files touching a date/time locale API are the listed ones", () => {
    const found = files.filter((f) => DATE_API.test(readFileSync(f, "utf8"))).map(rel);
    expect(
      found.sort(),
      "a file here formats a date or a time of its own. Route it through " +
        "src/lib/datetime.ts (formatCairo / formatCairoDate / formatCairoShort), or — " +
        "if it genuinely cannot — add it to ALLOWED in this file WITH A REASON (ADR-068)",
    ).toEqual(ALLOWED.map((a) => a.file).sort());
  });

  /* The allowlist would rot into a blanket exemption if a listed file could
     quietly change what it does. A "number" entry earns its place by having no
     Date in it AT ALL, so its toLocaleString cannot become a clock; a
     "date-only" entry may not grow one either (the test above already forbids
     that, for it as for everything else). */
  it.each(ALLOWED.filter((a) => a.kind === "number").map((a) => [a.file, a.why] as const))(
    "%s is number formatting, not a clock — it holds no Date",
    (file) => {
      const src = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(
        /\bDate\b/.test(src),
        `${file} is allowlisted as NUMBER formatting but now mentions Date — its ` +
          "toLocaleString may have become a clock (ADR-068)",
      ).toBe(false);
    },
  );

  /* The other half of the same promise: a clock that IS ours must still be
     told which language it is printing in. `formatCairo(x)` with no locale no
     longer compiles, so this only guards against someone re-adding a default. */
  it("formatCairo / formatCairoDate / formatCairoShort keep the locale REQUIRED", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "lib", "datetime.ts"), "utf8");
    expect(src).not.toMatch(/locale\s*:\s*Locale\s*=/);
    expect(src).toMatch(/export function formatCairo\([\s\S]*?locale: Locale,/);
    expect(src).toMatch(/export function formatCairoDate\([\s\S]*?locale: Locale\)/);
    expect(src).toMatch(/export function formatCairoShort\([\s\S]*?locale: Locale\)/);
  });

  /* The catastrophic edit, guarded in prose as well as in datetime.test.ts:
     wallClockParts is STORAGE and must stay 24-hour. */
  it("wallClockParts is still hour12:false — the storage layer never went twelve-hour", () => {
    const src = readFileSync(path.join(process.cwd(), "src", "lib", "datetime.ts"), "utf8");
    const wire = src.slice(src.indexOf("function wallClockParts"), src.indexOf("export function utcToCairo"));
    expect(wire).toContain("hour12: false");
    expect(wire).not.toContain("hour12: true");
  });
});
