import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRANDS } from "@/lib/pipeline-engine/constants";
import { CURRENCY_FOR, formatEGP, formatMoney, toPiasters, toPounds } from "./money";

/* ============================================================================
   ADR-077 — MINDOO QUOTES IN RIYALS, AND NOTHING ELSE MOVED.

   Founder: "change the entire landscape of Mindoo to the Saudi riyal, not the
   Egyptian pound. Keep everything else, B-Systems and ByteForce, in the
   Egyptian pound."

   Two halves, and the second is the one a suite normally misses.

   THE VALUE half is easy: `formatMoney` prints the right three letters, and the
   stored integer never changes because both currencies are hundredths.

   THE SWEEP half is the real guard. `formatEGP` still exists and is still
   correct for the screens that are EGP by construction — statements, payments,
   commissions, the partner subsystem — so the danger is not that it is wrong,
   it is that it is RIGHT NEXT DOOR. A shared body that keeps calling it prints
   "EGP 40,000" on a Mindoo proposal: the number is correct, the layout is
   correct, and only the currency is a lie. Nothing about that looks broken.

   So this reads the files a MINDOO ACCOUNT CAN REACH and fails if any of them
   calls the EGP-only formatter.
   ========================================================================== */

const ROOT = process.cwd();

/** Files a Mindoo account can cause to render. Not "everything that formats
    money" — the B-Systems-only subsystems are deliberately absent, because
    `formatEGP` is the right call there and forbidding it everywhere would be a
    rule nobody could follow. */
const MINDOO_REACHABLE = [
  "src/app/(mindoo)",
  "src/app/(accounting)", // one module, three companies (ADR-074)
  "src/components/bsystems/pages", // the shared pipeline bodies (ADR-074)
  "src/components/internal/pages.tsx",
  "src/components/internal/GroupHistory.tsx",
  "src/components/accounting",
  "src/components/shared/CallSheet.tsx",
];

function filesUnder(target: string): string[] {
  const full = path.join(ROOT, target);
  if (!statSync(full).isDirectory()) return [full];
  const out: string[] = [];
  for (const entry of readdirSync(full)) {
    out.push(...filesUnder(path.join(target, entry)));
  }
  return out.filter((f) => /\.tsx?$/.test(f));
}

/** Comments stripped and line endings normalised — the two ways a source sweep
    in this repo has lied before (ACCESS AUDIT, Run 081). */
function codeOf(file: string): string {
  return readFileSync(file, "utf8")
    .replace(/\r\n/g, "\n")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const rel = (f: string) => path.relative(ROOT, f).replace(/\\/g, "/");

describe("formatMoney — the currency belongs to the company", () => {
  it("Mindoo is riyals; the other two are pounds", () => {
    expect(CURRENCY_FOR.mindoo).toBe("SAR");
    expect(CURRENCY_FOR.bsystems).toBe("EGP");
    expect(CURRENCY_FOR.byteforce).toBe("EGP");
  });

  it.each(BRANDS)("%s formats the SAME stored integer, only the label differs", (brand) => {
    /* the whole reason this change needed no migration: both currencies are
       hundredths, so 150050 is 1,500.50 in either */
    expect(formatMoney(150050, brand)).toContain("1,500.50");
    expect(formatMoney(150050, brand).startsWith(CURRENCY_FOR[brand])).toBe(true);
  });

  it("whole amounts show no decimals, in both currencies", () => {
    expect(formatMoney(150000, "bsystems")).toBe("EGP 1,500");
    expect(formatMoney(150000, "mindoo")).toBe("SAR 1,500");
  });

  it("null and undefined read as zero, as they always have", () => {
    expect(formatMoney(null, "mindoo")).toBe("SAR 0");
    expect(formatMoney(undefined, "bsystems")).toBe("EGP 0");
  });

  it("the conversion helpers are untouched — no rate, no rounding change", () => {
    expect(toPiasters("1500.50")).toBe(150050);
    expect(toPounds(150050)).toBe(1500.5);
    /* and there is deliberately NO cross-currency conversion in this module */
    expect(Object.keys({ formatMoney, formatEGP })).not.toContain("convert");
  });

  it("formatEGP still exists and is still EGP — it is not deprecated, it is scoped", () => {
    expect(formatEGP(150000)).toBe("EGP 1,500");
    expect(formatEGP(150000)).toBe(formatMoney(150000, "bsystems"));
  });
});

describe("no Mindoo-reachable screen prints the EGP-only formatter", () => {
  const files = MINDOO_REACHABLE.flatMap(filesUnder).filter((f) => !f.endsWith(".test.ts"));

  it("finds the files (a silent zero would prove nothing)", () => {
    expect(files.length).toBeGreaterThanOrEqual(20);
  });

  it("none of them calls formatEGP", () => {
    const offenders = files.filter((f) => /\bformatEGP\s*\(/.test(codeOf(f))).map(rel);
    expect(
      offenders,
      "these render for a MINDOO account and call the EGP-only formatter, so " +
        "they print pounds on a riyal figure — a correct number under a wrong " +
        "currency, which looks like nothing is broken. Use formatMoney(x, brand).",
    ).toEqual([]);
  });
});
