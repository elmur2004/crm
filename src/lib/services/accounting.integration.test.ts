import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  createExpense,
  createMember,
  expenseSchema,
  updateExpense,
} from "./accounting";
import { importAccounting } from "@/lib/accounting/import";
import { exportCompanyDoc } from "@/lib/accounting/export";
import { loadBooks } from "@/lib/accounting/books";
import { expenseAmount, monthExpenses } from "@/lib/accounting/engine";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-058 — the ONE-MONTH payroll adjustment, against real rows.

   The founder: "when I edit an expense of the type of payroll and it is being
   edited it doesn't automatically edit in the actual payroll roster because it
   can be because of a deduction or something". The columns existed since the
   import; nothing in the app could ever WRITE them. These tests hold the write
   path: the Zod rules, the piaster scale through the DB→engine bridge, and the
   one that costs money if it slips — clearing a field must store NULL, not 0.
   ========================================================================== */

const actor: Actor = { id: null, label: "Payroll Admin" };
const M = "2026-03";

const base = {
  company: "byteforce" as const,
  month: M,
  type: "payroll" as const,
  name: "Nour",
  serviceLine: "branding" as const,
  amount: 500_000, // 5,000 EGP
  note: "",
  paid: false,
  rosterId: null,
};

async function member(over: Partial<{ name: string; salary: number; from: string }> = {}) {
  return createMember(
    {
      company: "byteforce",
      name: over.name ?? "Nour",
      role: "Designer",
      serviceLine: "branding",
      account: "",
      salary: over.salary ?? 500_000,
      active: true,
      from: over.from ?? "2026-01",
    },
    actor,
  );
}

describe("ADR-058 — deduction and bonus on the expense write path", () => {
  beforeEach(async () => {
    await resetDb();
  });

  describe("server-side Zod: the rules a client cannot skip", () => {
    it("refuses a negative deduction or bonus", () => {
      expect(expenseSchema.safeParse({ ...base, deduction: -1 }).success).toBe(false);
      expect(expenseSchema.safeParse({ ...base, bonus: -1 }).success).toBe(false);
    });

    it("refuses a fractional piaster and anything over the Int32 cap", () => {
      expect(expenseSchema.safeParse({ ...base, deduction: 1.5 }).success).toBe(false);
      expect(expenseSchema.safeParse({ ...base, bonus: 2_147_483_648 }).success).toBe(false);
    });

    it("refuses a deduction bigger than the salary plus the bonus — a NEGATIVE net is income", () => {
      const bad = expenseSchema.safeParse({ ...base, amount: 100_000, deduction: 150_000 });
      expect(bad.success).toBe(false);
      expect(bad.error!.issues[0]!.message).toBe(
        "A deduction cannot be larger than the salary plus the bonus.",
      );
      /* the bonus is part of the pot the deduction may eat */
      expect(
        expenseSchema.safeParse({ ...base, amount: 100_000, deduction: 150_000, bonus: 60_000 })
          .success,
      ).toBe(true);
    });

    it("a net of exactly zero is allowed — the boundary is not off by one", () => {
      const ok = expenseSchema.safeParse({ ...base, amount: 100_000, deduction: 100_000 });
      expect(ok.success).toBe(true);
    });

    it("accepts both as absent, null or a value — every shape the modal can send", () => {
      expect(expenseSchema.safeParse(base).success).toBe(true);
      expect(expenseSchema.safeParse({ ...base, deduction: null, bonus: null }).success).toBe(true);
      expect(expenseSchema.safeParse({ ...base, deduction: 0, bonus: 0 }).success).toBe(true);
    });

    it("does not police a NON-payroll row's net — the engine ignores the fields there", () => {
      const rent = expenseSchema.safeParse({
        ...base,
        type: "rent",
        amount: 100_00,
        deduction: 900_00,
      });
      expect(rent.success).toBe(true);
    });
  });

  it("writes both as Int piasters and the engine nets them end to end", async () => {
    const r = await member();
    const row = await createExpense(
      { ...base, rosterId: r.id, deduction: 20_000, bonus: 5_000, paid: true },
      actor,
    );
    const stored = await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.amount).toBe(500_000);
    expect(stored.deduction).toBe(20_000);
    expect(stored.bonus).toBe(5_000);

    const books = await loadBooks("byteforce");
    const rows = monthExpenses(books, M).filter((e) => e.type === "payroll");
    expect(rows).toHaveLength(1); // the derived row was replaced, never added to
    expect(expenseAmount(rows[0]!)).toBe(485_000);
  });

  it("strips a deduction that rides in on a NON-payroll row", async () => {
    const row = await createExpense(
      { ...base, type: "rent", name: "Office", deduction: 9_000, bonus: 1_000 },
      actor,
    );
    const stored = await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } });
    expect(stored.deduction).toBeNull();
    expect(stored.bonus).toBeNull();
  });

  it("CLEARING a field stores NULL, not 0 — the export must keep omitting the key", async () => {
    const r = await member();
    const row = await createExpense({ ...base, rosterId: r.id, deduction: 10_000 }, actor);
    expect((await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } })).deduction).toBe(
      10_000,
    );

    /* the modal sends null for a blank field (egpOrNull), never "0" */
    await updateExpense(row.id, { ...base, rosterId: r.id, deduction: null, bonus: null }, actor);
    const cleared = await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } });
    expect(cleared.deduction).toBeNull();
    expect(cleared.bonus).toBeNull();
    expect(cleared.deduction).not.toBe(0);

    const doc = await exportCompanyDoc("byteforce");
    const exported = doc.expenses as unknown as Array<Record<string, unknown>>;
    const mine = exported.find((e) => e["id"] === row.id)!;
    expect("deduction" in mine).toBe(false); // the SPA's document shape, unchanged
    expect("bonus" in mine).toBe(false);

    /* a typed 0 is a real 0 and DOES persist — blank and zero are not the same */
    await updateExpense(row.id, { ...base, rosterId: r.id, deduction: 0 }, actor);
    expect((await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } })).deduction).toBe(0);
  });

  it("EDITING an imported row preserves its deduction and bonus", async () => {
    /* the highest-severity regression: resolveExpenseData now writes both keys
       on every PATCH, so an edit is authoritative. A modal that failed to
       prefill them would silently zero an imported deduction and the month's
       cost would jump. The body here is exactly what the modal sends when
       nothing was changed. */
    await importAccounting(
      {
        openingBalance: 0,
        roster: [],
        expenses: [
          {
            id: "extra1",
            month: M,
            type: "payroll",
            name: "Contract QA",
            serviceLine: "",
            amount: 1000,
            deduction: 100,
            bonus: 50,
            note: "",
            paid: true,
            paidDate: `${M}-20`,
          },
        ],
        income: [],
        treasury: [],
        loans: [],
        mediaLedger: [],
        targets: [],
        payrollPaid: {},
      },
      "byteforce",
      actor,
    );
    const imported = await db.acctExpense.findFirstOrThrow({ where: { name: "Contract QA" } });
    expect(imported.deduction).toBe(100_00);
    expect(imported.bonus).toBe(50_00);

    await updateExpense(
      imported.id,
      {
        company: "byteforce",
        month: M,
        type: "payroll",
        name: "Contract QA",
        serviceLine: "",
        amount: 1000_00,
        deduction: 100_00, // prefilled from the DTO — unchanged
        bonus: 50_00,
        note: "",
        paid: true,
        rosterId: null,
      },
      actor,
    );
    const after = await db.acctExpense.findUniqueOrThrow({ where: { id: imported.id } });
    expect(after.deduction).toBe(100_00);
    expect(after.bonus).toBe(50_00);
    expect(expenseAmount({ ...after, auto: false } as never)).toBe(950_00);
  });
});
