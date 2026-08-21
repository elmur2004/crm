import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  createExpense,
  createIncome,
  createMember,
  deleteExpense,
  expenseSchema,
  toggleExpensePaid,
  togglePayrollMark,
  updateExpense,
  updateMember,
} from "./accounting";
import { cairoToday } from "@/lib/accounting/now";
import { importAccounting } from "@/lib/accounting/import";
import { exportCompanyDoc } from "@/lib/accounting/export";
import { loadBooks } from "@/lib/accounting/books";
import {
  addMonths,
  apTotal,
  autoPayroll,
  dashboard,
  departments,
  expenseAmount,
  memberAt,
  monthExpenses,
  paidExpenseIn,
  pendingExpenseIn,
  pnl,
  treasuryThrough,
} from "@/lib/accounting/engine";
import { ACCT_DEPTS } from "@/lib/accounting/constants";
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

/* ==========================================================================
   ADR-058 — THE PAID-STATE TRAP, transition by transition.

   Two stores hold one fact. A DERIVED salary's approval is an
   AcctPayrollPayment row (the SPA's payrollPaid map); a MANUAL row's approval
   is its own `paid` flag. Crossing between them must never flip the state
   silently in either direction, never count a person twice, and never lose an
   approval — an approval is a full salary's worth of cash either way.
   ========================================================================== */

const payrollRows = async (m: string) => {
  const books = await loadBooks("byteforce");
  return monthExpenses(books, m).filter((e) => e.type === "payroll");
};
const mark = (memberId: string, month: string) =>
  db.acctPayrollPayment.findUnique({ where: { memberId_month: { memberId, month } } });

/* Approve the DERIVED salary exactly as the row's ✓ does, then backdate the
   mark to the day it was really approved. Every "the original approval date
   survives" assertion below would pass by accident on today's date. */
const APPROVED_ON = "2026-03-05";
async function approveDerived(memberId: string, month: string): Promise<void> {
  expect(APPROVED_ON).not.toBe(cairoToday()); // the whole point of the date
  await togglePayrollMark({ company: "byteforce", memberId, month }, actor);
  await db.acctPayrollPayment.updateMany({
    where: { memberId, month },
    data: { paidDate: APPROVED_ON },
  });
}

describe("ADR-058 — the month-only override and the approval it carries", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("1 · UNPAID auto → override: nothing to carry, and the person is counted ONCE", async () => {
    const r = await member();
    expect(await mark(r.id, M)).toBeNull();

    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: false }, actor);

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(1); // never two — the derived row is REPLACED
    expect(rows[0]!.auto).toBeUndefined();
    expect(rows[0]!.paid).toBe(false);
    expect(await mark(r.id, M)).toBeNull();

    const books = await loadBooks("byteforce");
    expect(paidExpenseIn(books, M)).toBe(0);
    expect(pendingExpenseIn(books, M)).toBe(480_000);
  });

  it("2 · PAID auto → override: the approval does NOT silently drop, and never double counts", async () => {
    const r = await member();
    await approveDerived(r.id, M);
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(500_000);

    /* the prefilled modal carries the derived row's Paid across */
    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: true }, actor);

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(1); // the dormant mark contributes NO row
    expect(rows[0]!.paid).toBe(true);
    const books = await loadBooks("byteforce");
    expect(paidExpenseIn(books, M)).toBe(480_000); // the NET, not salary + net
    /* the mark is re-asserted, never RE-DATED: an override typed today must not
       start claiming the person-month was approved today */
    expect((await mark(r.id, M))!.paidDate).toBe(APPROVED_ON);
  });

  it("2b · overriding a PAID auto row with On hold un-approves the MONTH and PARKS the approval", async () => {
    const r = await member();
    await approveDerived(r.id, M);

    /* "+ Add expense" → Payroll → pick a person ships Status = On hold. The
       month loses the salary from paid spend — visibly, on the row — but the
       approval itself is not the founder's to lose by accident. */
    const row = await createExpense({ ...base, rosterId: r.id, paid: false }, actor);

    const books = await loadBooks("byteforce");
    expect(paidExpenseIn(books, M)).toBe(0); // the whole salary left cash
    expect(pendingExpenseIn(books, M)).toBe(500_000);
    /* PARKED, not destroyed: inert while covered (the dormant-mark equivalence
       test below proves that to the piaster) and the only thing a delete can
       rebuild the derived row's approval from */
    expect((await mark(r.id, M))!.paidDate).toBe(APPROVED_ON);

    await deleteExpense(row.id, "byteforce", actor);
    expect((await payrollRows(M))[0]!).toMatchObject({
      auto: true,
      amount: 500_000,
      paid: true,
      paidDate: APPROVED_ON,
    });
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(500_000); // all of it back
  });

  it("2c · un-approving the covering row IS deliberate — that mark goes, and stays gone", async () => {
    const r = await member();
    await approveDerived(r.id, M);
    const row = await createExpense({ ...base, rosterId: r.id, paid: true }, actor);

    /* Status → On hold in the Edit modal: the founder said so, in as many words */
    await updateExpense(row.id, { ...base, rosterId: r.id, paid: false }, actor);
    expect(await mark(r.id, M)).toBeNull();
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(0);

    await deleteExpense(row.id, "byteforce", actor);
    expect((await payrollRows(M))[0]!).toMatchObject({ auto: true, paid: false });
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(0);
  });

  it("3 · deleting an UNPAID override brings the derived row back ON HOLD", async () => {
    const r = await member();
    const row = await createExpense({ ...base, rosterId: r.id, deduction: 20_000 }, actor);

    await deleteExpense(row.id, "byteforce", actor);

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("pay:" + M + ":" + r.id); // the DERIVED row, back
    expect(rows[0]!).toMatchObject({ auto: true, amount: 500_000, deduction: null, bonus: null });
    expect(rows[0]!.paid).toBe(false);
    expect(await mark(r.id, M)).toBeNull();
    const books = await loadBooks("byteforce");
    expect(paidExpenseIn(books, M)).toBe(0);
    expect(pendingExpenseIn(books, M)).toBe(500_000); // the deduction went with it
  });

  it("4 · deleting a PAID override keeps the approval AND the date HE approved it on", async () => {
    const r = await member();
    await approveDerived(r.id, M); // approved on the 5th, months before today
    const row = await createExpense(
      { ...base, rosterId: r.id, deduction: 20_000, paid: true },
      actor,
    );
    /* the override's OWN paidDate is today — and it is NOT what the derived row
       is rebuilt from, which is the whole reason this date is seeded apart */
    const onTheRow = (await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } })).paidDate;
    expect(onTheRow).toBe(cairoToday());

    await deleteExpense(row.id, "byteforce", actor);

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.auto).toBe(true);
    expect(rows[0]!.paid).toBe(true); // the approval was CARRIED, not lost
    expect(rows[0]!.paidDate).toBe(APPROVED_ON); // and not re-stamped with today
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(500_000);
  });

  it("4b · an approval that ORIGINATES on the override carries the override's own date", async () => {
    const r = await member();
    const row = await createExpense(
      { ...base, rosterId: r.id, deduction: 20_000, paid: true },
      actor,
    );
    const approvedOn = (await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } })).paidDate;

    await deleteExpense(row.id, "byteforce", actor);

    /* nothing was ever on record for this person-month, so the row's own date is
       the only truthful answer */
    expect((await payrollRows(M))[0]!).toMatchObject({ auto: true, paid: true, paidDate: approvedOn });
    expect(await mark(r.id, M)).not.toBeNull();
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(500_000);
  });

  it("5 · toggling the override, then deleting it: the override's FINAL state wins", async () => {
    const r = await member();
    const row = await createExpense({ ...base, rosterId: r.id, paid: false }, actor);
    expect(await mark(r.id, M)).toBeNull();

    await toggleExpensePaid(row.id, "byteforce", actor); // the ✓ on the override
    expect(await mark(r.id, M)).not.toBeNull(); // the shadow tracked the toggle

    await deleteExpense(row.id, "byteforce", actor);
    expect((await payrollRows(M))[0]!).toMatchObject({ auto: true, paid: true });

    /* and back the other way: approve, un-approve, delete → ON HOLD */
    const again = await createExpense({ ...base, rosterId: r.id, paid: true }, actor);
    await toggleExpensePaid(again.id, "byteforce", actor);
    expect(await mark(r.id, M)).toBeNull();
    await deleteExpense(again.id, "byteforce", actor);
    expect((await payrollRows(M))[0]!.paid).toBe(false);
  });

  it("6 · MOVING an override to another month hands the old month's approval back", async () => {
    const r = await member();
    const next = addMonths(M, 1);
    const row = await createExpense({ ...base, rosterId: r.id, paid: true }, actor);

    await updateExpense(row.id, { ...base, month: next, rosterId: r.id, paid: true }, actor);

    const books = await loadBooks("byteforce");
    /* M: the derived row is back and PAID — the old key was released carrying
       the state the override had */
    const atM = monthExpenses(books, M).filter((e) => e.type === "payroll");
    expect(atM).toHaveLength(1);
    expect(atM[0]!).toMatchObject({ auto: true, paid: true });
    /* next: covered by the override, exactly once */
    const atNext = monthExpenses(books, next).filter((e) => e.type === "payroll");
    expect(atNext).toHaveLength(1);
    expect(atNext[0]!.id).toBe(row.id);
    expect(autoPayroll(books, next)).toEqual([]);
  });

  it("6b · MOVING an override to another PERSON hands the first person's approval back", async () => {
    const one = await member({ name: "Nour" });
    const two = await member({ name: "Aya" });
    const row = await createExpense({ ...base, rosterId: one.id, paid: true }, actor);

    await updateExpense(row.id, { ...base, rosterId: two.id, paid: false }, actor);

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(2); // one derived + one override, never three
    const nour = rows.find((e) => e.rosterId === one.id)!;
    expect(nour).toMatchObject({ auto: true, paid: true }); // approval handed back
    const aya = rows.find((e) => e.rosterId === two.id)!;
    expect(aya.auto).toBeUndefined();
    expect(aya.paid).toBe(false);
    expect(await mark(one.id, M)).not.toBeNull();
    expect(await mark(two.id, M)).toBeNull();
  });

  it("6c · turning an override into a NON-payroll row releases the person-month too", async () => {
    const r = await member();
    const row = await createExpense({ ...base, rosterId: r.id, paid: true }, actor);

    await updateExpense(
      row.id,
      { ...base, type: "rent", name: "Office", rosterId: r.id, paid: true },
      actor,
    );

    const rows = await payrollRows(M);
    expect(rows).toHaveLength(1);
    expect(rows[0]!).toMatchObject({ auto: true, paid: true });
    expect(await mark(r.id, M)).not.toBeNull();
    /* and the moved row kept none of the payroll vocabulary */
    const moved = await db.acctExpense.findUniqueOrThrow({ where: { id: row.id } });
    expect(moved.rosterId).toBeNull();
    expect(moved.deduction).toBeNull();
  });

  it("6d · moving an ON HOLD override ONTO an approved person-month leaves that approval standing", async () => {
    const one = await member({ name: "Nour" });
    const two = await member({ name: "Sara" });
    await approveDerived(one.id, M);
    await approveDerived(two.id, M);
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(1_000_000);

    const row = await createExpense({ ...base, rosterId: one.id, paid: false }, actor);
    await updateExpense(row.id, { ...base, rosterId: two.id, paid: false }, actor);

    /* Nour is released and comes back approved; Sara is now the covered one, so
       only HER salary is out of paid spend — never both, and never for good */
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(500_000);
    expect((await mark(one.id, M))!.paidDate).toBe(APPROVED_ON);
    expect((await mark(two.id, M))!.paidDate).toBe(APPROVED_ON);

    await deleteExpense(row.id, "byteforce", actor);
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(1_000_000);
  });

  it("7 · a SECOND covering row for the same person-month is REFUSED — nobody is paid twice", async () => {
    const r = await member();
    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: true }, actor);

    /* `autoPayroll`'s `covered` set drops the DERIVED row once; two stored rows
       would both survive `monthExpenses` and both count a full salary */
    await expect(createExpense({ ...base, rosterId: r.id, paid: true }, actor)).rejects.toMatchObject({
      status: 400,
    });

    /* and on the EDIT path: an override may not be MOVED onto a month that
       already has one */
    const next = addMonths(M, 1);
    const other = await createExpense({ ...base, month: next, rosterId: r.id, paid: false }, actor);
    await expect(
      updateExpense(other.id, { ...base, month: M, rosterId: r.id, paid: false }, actor),
    ).rejects.toMatchObject({ status: 400 });
    expect((await db.acctExpense.findUniqueOrThrow({ where: { id: other.id } })).month).toBe(next);

    const books = await loadBooks("byteforce");
    expect(monthExpenses(books, M).filter((e) => e.type === "payroll")).toHaveLength(1);
    expect(paidExpenseIn(books, M)).toBe(480_000); // ONE net salary, not two

    /* the UNLINKED extra-payroll row is a different thing and stays allowed: it
       adds on top instead of claiming the person's salary */
    await createExpense({ ...base, name: "Eid bonus", amount: 50_000, rosterId: null, paid: true }, actor);
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(530_000);
  });

  it("8 · a paid row for a month the ROSTER does not pay leaves no orphan approval", async () => {
    const r = await member(); // on the payroll from 2026-01
    const off = {
      company: "byteforce" as const,
      name: "Nour",
      role: "Designer",
      serviceLine: "branding" as const,
      account: "",
      salary: 500_000,
      from: M,
    };
    await updateMember(r.id, { ...off, active: false }, actor);
    expect(autoPayroll(await loadBooks("byteforce"), M)).toEqual([]);

    const row = await createExpense({ ...base, amount: 300_000, rosterId: r.id, paid: true }, actor);
    await deleteExpense(row.id, "byteforce", actor);
    expect(await mark(r.id, M)).toBeNull(); // there was no derived row to hand it to

    /* and putting him back on the payroll over that month does not resurrect a
       salary nobody ever ticked */
    await updateMember(r.id, { ...off, active: true }, actor);
    expect((await payrollRows(M))[0]!).toMatchObject({ auto: true, amount: 500_000, paid: false });
    expect(paidExpenseIn(await loadBooks("byteforce"), M)).toBe(0);
  });

  it("a DORMANT mark adds nothing anywhere — every total is identical with and without it", async () => {
    const r = await member();
    await togglePayrollMark({ company: "byteforce", memberId: r.id, month: M }, actor);
    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: true }, actor);

    const withMark = await loadBooks("byteforce");
    await db.acctPayrollPayment.deleteMany({});
    const without = await loadBooks("byteforce");

    const NOW = addMonths(M, 1);
    expect(paidExpenseIn(withMark, M)).toBe(paidExpenseIn(without, M));
    expect(pnl(withMark, M).totalExpenses).toBe(pnl(without, M).totalExpenses);
    expect(apTotal(withMark, NOW)).toBe(apTotal(without, NOW));
    expect(treasuryThrough(withMark, M)).toBe(treasuryThrough(without, M));
    expect(dashboard(withMark, M, NOW).expensesPaid).toBe(dashboard(without, M, NOW).expensesPaid);
    expect(departments(withMark, M, "month", NOW, ACCT_DEPTS).rows).toEqual(
      departments(without, M, "month", NOW, ACCT_DEPTS).rows,
    );
  });

  it("the override never edits the roster — the salary and every other month stand", async () => {
    const r = await member();
    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: true }, actor);

    const books = await loadBooks("byteforce");
    const stored = books.roster.find((x) => x.id === r.id)!;
    const NOW = addMonths(M, 1);
    expect(stored.segments).toHaveLength(1); // no new effective-dated segment
    expect(memberAt(stored, M).salary).toBe(500_000);
    expect(memberAt(stored, NOW).salary).toBe(500_000);
    expect(dashboard(books, M, NOW).committedSalary).toBe(500_000);
    /* the very next month is untouched: full salary, derived, on hold */
    const nextRows = monthExpenses(books, NOW).filter((e) => e.type === "payroll");
    expect(nextRows).toHaveLength(1);
    expect(nextRows[0]!).toMatchObject({ auto: true, amount: 500_000, paid: false });
  });

  it("the override lands in the person's DEPARTMENT, not shared overhead", async () => {
    const r = await member();
    await createExpense({ ...base, rosterId: r.id, deduction: 20_000, paid: true }, actor);
    const books = await loadBooks("byteforce");
    const NOW = addMonths(M, 1);
    const report = departments(books, M, "month", NOW, ACCT_DEPTS);
    expect(report.rows.find((x) => x.id === "branding")!.cost).toBe(480_000);
    expect(report.overhead).toBe(0);
  });
});

/* ==========================================================================
   ADR-058 — THE MONEY PROOF, to the piaster.

   One month, two people on the roster, one collected invoice. A deduction
   override on one and a bonus override on the other, and then the ✓ on the
   second. After every step: the month's payroll total, the P&L, accounts
   payable and the treasury each move by EXACTLY the adjustment and nothing
   else, and each person is counted exactly ONCE.
   ========================================================================== */

describe("ADR-058 — the money proof", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("a deduction and a bonus move every total by exactly themselves, and nobody twice", async () => {
    /* both start IN the proved month and "now" IS that month, so accounts
       payable is this month's alone — an unpaid salary in every earlier month
       would otherwise dominate the number and hide the movement */
    const NOW = M;
    const nour = await member({ name: "Nour", from: M }); // 5,000 EGP, branding
    const sara = await createMember(
      {
        company: "byteforce",
        name: "Sara",
        role: "Editor",
        serviceLine: "video",
        account: "",
        salary: 700_000, // 7,000 EGP
        active: true,
        from: M,
      },
      actor,
    );
    await createIncome(
      {
        company: "byteforce",
        month: M,
        type: "invoice",
        client: "Acme",
        serviceLine: "branding",
        amount: 2_000_000, // 20,000 EGP collected
        note: "",
        collected: true,
        collectedDate: `${M}-10`,
      },
      actor,
    );
    /* Nour's salary is approved, Sara's is not — so the on-hold half of every
       total has something to move too */
    await approveDerived(nour.id, M);

    const totals = async () => {
      const books = await loadBooks("byteforce");
      const rows = monthExpenses(books, M).filter((e) => e.type === "payroll");
      return {
        /* the Payroll section's own total — every row's NET, derived or not */
        payrollRows: rows.length,
        people: new Set(rows.map((e) => e.rosterId)).size,
        derived: autoPayroll(books, M).length,
        monthPayroll: rows.reduce((s, e) => s + expenseAmount(e), 0),
        paid: paidExpenseIn(books, M),
        pending: pendingExpenseIn(books, M),
        pnlExpenses: pnl(books, M).totalExpenses,
        pnlNet: pnl(books, M).net,
        ap: apTotal(books, NOW),
        treasury: treasuryThrough(books, M),
        committedSalary: dashboard(books, M, NOW).committedSalary,
      };
    };

    /* ---- 0 · the baseline: two DERIVED salaries, one approved */
    expect(await totals()).toEqual({
      payrollRows: 2,
      people: 2,
      derived: 2,
      monthPayroll: 1_200_000, // 5,000 + 7,000
      paid: 500_000,
      pending: 700_000,
      pnlExpenses: 500_000,
      pnlNet: 1_500_000, // 20,000 collected − 5,000 paid
      ap: 700_000,
      treasury: 1_500_000,
      committedSalary: 1_200_000,
    });

    /* ---- 1 · "Adjust this month only" on Nour: −200 EGP, Status carried Paid */
    await createExpense(
      { ...base, name: "Nour", rosterId: nour.id, deduction: 20_000, paid: true },
      actor,
    );
    expect(await totals()).toEqual({
      payrollRows: 2, // the override REPLACED the derived row, never joined it
      people: 2,
      derived: 1, // only Sara is still derived
      monthPayroll: 1_180_000, // −20,000 piasters, exactly the deduction
      paid: 480_000, // −20,000
      pending: 700_000, // untouched
      pnlExpenses: 480_000, // −20,000
      pnlNet: 1_520_000, // +20,000
      ap: 700_000, // untouched
      treasury: 1_520_000, // +20,000 — the cash he did not pay out
      committedSalary: 1_200_000, // THE ROSTER DID NOT MOVE
    });

    /* ---- 2 · and on Sara: +300 EGP bonus, Status carried On hold */
    const saraRow = await createExpense(
      {
        ...base,
        name: "Sara",
        serviceLine: "video",
        rosterId: sara.id,
        amount: 700_000,
        bonus: 30_000,
        paid: false,
      },
      actor,
    );
    expect(await totals()).toEqual({
      payrollRows: 2,
      people: 2,
      derived: 0,
      monthPayroll: 1_210_000, // +30,000, exactly the bonus
      paid: 480_000, // untouched — an unapproved bonus costs no cash
      pending: 730_000, // +30,000
      pnlExpenses: 480_000, // untouched
      pnlNet: 1_520_000, // untouched
      ap: 730_000, // +30,000
      treasury: 1_520_000, // untouched — THE APPROVAL GATE HOLDS
      committedSalary: 1_200_000,
    });

    /* ---- 3 · the ✓ on Sara's row: the whole net becomes cash, at once */
    await toggleExpensePaid(saraRow.id, "byteforce", actor);
    expect(await totals()).toEqual({
      payrollRows: 2,
      people: 2,
      derived: 0,
      monthPayroll: 1_210_000,
      paid: 1_210_000, // +730,000, the net Sara is actually owed
      pending: 0,
      pnlExpenses: 1_210_000,
      pnlNet: 790_000, // 20,000 − 12,100
      ap: 0,
      treasury: 790_000,
      committedSalary: 1_200_000,
    });

    /* ---- and the cost landed in the right DEPARTMENTS, not shared overhead */
    const report = departments(await loadBooks("byteforce"), M, "month", NOW, ACCT_DEPTS);
    expect(report.rows.find((x) => x.id === "branding")!.cost).toBe(480_000);
    expect(report.rows.find((x) => x.id === "video")!.cost).toBe(730_000);
    expect(report.overhead).toBe(0);
    /* 1,200,000 − 20,000 + 30,000 = 1,210,000. One salary each, once. */
    expect(480_000 + 730_000).toBe(1_200_000 - 20_000 + 30_000);
  });
});
