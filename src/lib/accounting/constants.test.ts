import { describe, expect, it } from "vitest";
import type { Msg } from "@/lib/i18n/core";
import {
  ACCT_COMPANIES,
  ACCT_DEPT_LABELS,
  ACCT_DEPTS,
  ACCT_EXPENSE_TYPE_LABELS,
  ACCT_EXPENSE_TYPES,
  ACCT_INCOME_TYPE_LABELS,
  ACCT_INCOME_TYPES,
  mediaHidden,
} from "./constants";

/* ============================================================================
   ADR-060 — the vocabulary guard.

   The unions in constants.ts ARE the schema (the Prisma columns are plain
   TEXT), so this file pins the three invariants the founder's additions rest
   on: every id ships with a REAL label in BOTH languages; "Other" stays last
   in every dropdown and report; and the B-Systems hiding rule stays STRICT
   EQUALITY on the two pass-through literals — a prefix match would silently
   hide "media_campaign" (which the founder wants visible to everyone) and
   drop the "bsystems" department.
   ========================================================================== */

function assertLabels(ids: readonly string[], labels: Record<string, Msg>) {
  for (const id of ids) {
    const label = labels[id];
    expect(label, `label missing for "${id}"`).toBeDefined();
    expect(label!.en.trim().length, `empty EN label for "${id}"`).toBeGreaterThan(0);
    expect(label!.ar.trim().length, `empty AR label for "${id}"`).toBeGreaterThan(0);
  }
}

describe("accounting vocabulary (ADR-060)", () => {
  it("every id carries a real EN and AR label", () => {
    assertLabels(ACCT_DEPTS, ACCT_DEPT_LABELS as Record<string, Msg>);
    assertLabels(ACCT_EXPENSE_TYPES, ACCT_EXPENSE_TYPE_LABELS as Record<string, Msg>);
    assertLabels(ACCT_INCOME_TYPES, ACCT_INCOME_TYPE_LABELS as Record<string, Msg>);
  });

  it("the founder's additions exist, and Other stays last everywhere", () => {
    expect(ACCT_EXPENSE_TYPES).toContain("media_campaign");
    expect(ACCT_DEPTS).toContain("bsystems");
    expect(ACCT_DEPTS[ACCT_DEPTS.length - 1]).toBe("other");
    expect(ACCT_EXPENSE_TYPES[ACCT_EXPENSE_TYPES.length - 1]).toBe("other");
    expect(ACCT_INCOME_TYPES[ACCT_INCOME_TYPES.length - 1]).toBe("other");
  });

  it("the two media types stay adjacent so the distinction is visible at the point of choice", () => {
    expect(ACCT_EXPENSE_TYPES.indexOf("media_campaign")).toBe(ACCT_EXPENSE_TYPES.indexOf("media") + 1);
  });

  it("hiding stays strict equality: bsystems loses ONLY the two pass-through literals", () => {
    for (const company of ACCT_COMPANIES) {
      /* replicate the three call-site gates (expense dropdown, income dropdown,
         departments report) exactly as written */
      const keptExpense = ACCT_EXPENSE_TYPES.filter((x) => x !== "media" || !mediaHidden(company));
      const keptIncome = ACCT_INCOME_TYPES.filter((x) => x !== "media_fee" || !mediaHidden(company));
      const keptDepts = ACCT_DEPTS.filter((d) => d !== "media_fee" || !mediaHidden(company));
      const removed = (all: readonly string[], kept: readonly string[]) =>
        all.filter((x) => !kept.includes(x));
      if (mediaHidden(company)) {
        expect(removed(ACCT_EXPENSE_TYPES, keptExpense)).toEqual(["media"]);
        expect(removed(ACCT_INCOME_TYPES, keptIncome)).toEqual(["media_fee"]);
        expect(removed(ACCT_DEPTS, keptDepts)).toEqual(["media_fee"]);
      } else {
        expect(removed(ACCT_EXPENSE_TYPES, keptExpense)).toEqual([]);
        expect(removed(ACCT_INCOME_TYPES, keptIncome)).toEqual([]);
        expect(removed(ACCT_DEPTS, keptDepts)).toEqual([]);
      }
      /* the additions survive under BOTH companies, whatever hiding does */
      expect(keptExpense).toContain("media_campaign");
      expect(keptDepts).toContain("bsystems");
    }
    expect(mediaHidden("bsystems")).toBe(true);
    expect(mediaHidden("byteforce")).toBe(false);
  });
});
