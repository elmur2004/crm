/* The ONLY money converter/formatter (ADR-018, A-9). All persisted amounts are
   integer MINOR UNITS. Zod caps values at Int32.

   ADR-077 — "piasters" is the name the codebase has always used and it is kept,
   but the unit is now whichever minor unit the company's currency has. Both of
   ours are hundredths, so the arithmetic is identical; see CURRENCY_FOR. */

import type { Brand } from "@/lib/pipeline-engine/constants";

export const CURRENCY = "EGP" as const; // A-9 — configurable constant

/* ============================================================================
   ADR-077 — MONEY HAS A CURRENCY, AND THE CURRENCY BELONGS TO THE COMPANY.

   Founder: "change the entire landscape of Mindoo to the Saudi riyal, not the
   Egyptian pound. Keep everything else, B-Systems and ByteForce, in the
   Egyptian pound."

   This is a deviation from SPEC §2 ("Currency: EGP"), recorded as an ADR
   because CLAUDE.md requires one — and it is a deviation in the LABEL only.

   NOTHING IS STORED DIFFERENTLY AND NOTHING NEEDS CONVERTING. Every amount in
   this database is an integer in MINOR UNITS (ADR-018), and the riyal has two
   decimal places exactly as the pound does: 150050 is 1,500.50 in either
   currency. So `toPiasters`/`toPounds` are untouched, no migration exists for
   this change, and no stored figure moves. What changes is the three letters
   printed in front of the number.

   THE RATE IS DELIBERATELY ABSENT. There is no conversion anywhere here, and
   there must not be one: a Mindoo deal is quoted, invoiced and collected in
   riyals, and a B-Systems deal in pounds. They are separate books that are
   never summed — the accounting module already scopes every figure to ONE
   company (ADR-052's company filter, ADR-074's tenancy), so there is no screen
   on which a pound and a riyal are added together. The day one exists, it needs
   a rate and a date, and that is a decision to take then rather than a default
   to leave lying around now.
   ========================================================================== */

/** The currency each company quotes, invoices and collects in. */
export const CURRENCY_FOR: Record<Brand, string> = {
  byteforce: "EGP",
  bsystems: "EGP",
  mindoo: "SAR", // ADR-077 — founder
};

/** The locale each currency reads best in — thousands separators and digit
    shapes. Both are en-* so an English page stays English; the Arabic side of
    the app formats through the same call and picks its own numerals upstream. */
const MONEY_LOCALE: Record<string, string> = { EGP: "en-EG", SAR: "en-SA" };

/** 150050 → "EGP 1,500.50" | "SAR 1,500.50", by COMPANY.

    Required argument, never defaulted: a default would be EGP, and an EGP
    default is exactly how a Mindoo screen ends up quietly printing the wrong
    currency — the number would look right, which is the worst kind of wrong. */
export function formatMoney(piasters: number | null | undefined, brand: Brand): string {
  const currency = CURRENCY_FOR[brand];
  const p = piasters ?? 0;
  const hasFraction = p % 100 !== 0;
  return `${currency} ${(p / 100).toLocaleString(MONEY_LOCALE[currency] ?? "en-EG", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export const MAX_PIASTERS = 2_147_483_647; // Int32 cap ≈ 21.4M EGP (ADR-018)

/** "1500.50" | 1500.5 → 150050 piasters. Throws on negatives/overflow/NaN. */
export function toPiasters(pounds: number | string): number {
  const n = typeof pounds === "string" ? Number(pounds.replace(/,/g, "")) : pounds;
  if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid money amount: ${pounds}`);
  const piasters = Math.round(n * 100);
  if (piasters > MAX_PIASTERS) throw new Error(`Amount exceeds cap: ${pounds}`);
  return piasters;
}

/** 150050 → 1500.5 */
export function toPounds(piasters: number): number {
  return piasters / 100;
}

/** 150050 → "EGP 1,500.50" (no decimals shown for whole amounts).

    ADR-077 — for the screens that are EGP BY CONSTRUCTION: the partner and
    agent subsystem, statements, payments and commissions, all of which are
    B-Systems' alone and can never render a Mindoo figure. Anything that a
    Mindoo account can reach must call `formatMoney` with its brand instead, and
    `money-currency.test.ts` sweeps the shared bodies to keep that true. */
export function formatEGP(piasters: number | null | undefined): string {
  const p = piasters ?? 0;
  const pounds = p / 100;
  const hasFraction = p % 100 !== 0;
  return `${CURRENCY} ${pounds.toLocaleString("en-EG", {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

/** Dashboard sums treat missing as 0 (SPEC §6.5). */
export function sumPiasters(values: Array<number | null | undefined>): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
