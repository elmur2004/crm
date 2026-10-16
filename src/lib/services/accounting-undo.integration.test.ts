import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   ADR-086 — ACCOUNTING UNDO / REDO, against real rows and a real Postgres.

   Founder: "add an undo and redo button for the accounting system". Asked to
   choose, he answered ONE STEP (Undo reverses your last accounting action, Redo
   puts it back) and PERSONAL (you can only undo what you yourself did).

   This is money, so the assertion that matters is not "a field I chose came
   back" — it is `books()`, the WHOLE accounting database, compared row for row
   and column for column, ids and timestamps included:

       before  →  act  →  after  →  undo  →  == before  →  redo  →  == after

   Every one of the 24 mutations runs that round trip in the table below, plus
   the payroll-linked variants where ADR-058's approval mark moves with the row.
   Everything else here is a GUARD, and a guard is only worth the test that can
   see it fail: the fingerprint refusals (including the three tables with no
   `updatedAt`), the personal and per-company walls, the one-step rule, the
   claim-first race, the window, and the isolation from the CRM's stack.

   The ONE thing mocked is the session, for the two route tests — the services,
   the guards and the database are all real (the module-access.integration.test
   pattern).
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { ApiError } from "@/lib/api-error";
import type { Actor } from "./activity";
import {
  addLoanPayment,
  createExpense,
  createIncome,
  createLoan,
  createMember,
  createMove,
  deleteExpense,
  deleteIncome,
  deleteLoan,
  deleteMember,
  deleteMove,
  deleteTarget,
  mediaReceived,
  mediaSent,
  setOpeningBalance,
  setTarget,
  toggleExpensePaid,
  toggleIncomeCollected,
  toggleMemberActive,
  togglePayrollMark,
  updateExpense,
  updateIncome,
  updateMember,
  updateMove,
} from "./accounting";
import {
  pendingAcctRedo,
  pendingAcctUndo,
  performAcctRedo,
  performAcctUndo,
  recordAcctUndo,
  type AcctUndoKind,
} from "./accounting-undo";
import { ACCT_UNDO_REASONS, AcctUndoError } from "@/lib/accounting/undo-reasons";
import { acctUndoRefusal } from "@/components/accounting/AcctUndoRedoButtons";
import { acct } from "@/lib/i18n/dict/accounting";
import { invalidateUndo, pendingUndoFor, performUndo, UNDO_WINDOW_MS } from "./undo";
import { createLead, deleteLead, setArchived } from "./leads";
import { POST as undoRoute } from "@/app/api/accounting/undo/route";
import { POST as redoRoute } from "@/app/api/accounting/redo/route";

/* ------------------------------------------------------------------ fixtures */

const CO = "byteforce" as const;
const OTHER = "bsystems" as const;
const M = "2026-03";

let seq = 0;
async function makeUser(name = "Books Admin"): Promise<Actor & { id: string }> {
  const user = await db.user.create({
    data: {
      name,
      phone: `+2010777000${seq++}`,
      passwordHash: "x",
      roles: { create: [{ role: "bsystems_admin" }] },
    },
  });
  return { id: user.id, label: user.name };
}

/** THE assertion surface: every accounting table, whole rows, stable order. */
async function books() {
  const by = { orderBy: { id: "asc" as const } };
  const [
    income,
    expense,
    member,
    segment,
    mark,
    move,
    loan,
    loanPayment,
    media,
    target,
    settings,
  ] = await Promise.all([
    db.acctIncome.findMany(by),
    db.acctExpense.findMany(by),
    db.acctRosterMember.findMany(by),
    db.acctRosterSegment.findMany(by),
    db.acctPayrollPayment.findMany(by),
    db.acctTreasuryMove.findMany(by),
    db.acctLoan.findMany(by),
    db.acctLoanPayment.findMany(by),
    db.acctMediaEntry.findMany(by),
    db.acctTarget.findMany(by),
    db.acctSettings.findMany(by),
  ]);
  return { income, expense, member, segment, mark, move, loan, loanPayment, media, target, settings };
}

const incomeInput = (over: Partial<Parameters<typeof createIncome>[0]> = {}) => ({
  company: CO,
  month: M,
  type: "invoice" as const,
  client: "Acme Trading",
  serviceLine: "web" as const,
  amount: 750_00,
  note: "retainer",
  collected: false,
  ...over,
});

const expenseInput = (over: Partial<Parameters<typeof createExpense>[0]> = {}) => ({
  company: CO,
  month: M,
  type: "rent" as const,
  name: "Office rent",
  serviceLine: "" as const,
  amount: 1_200_00,
  note: "",
  paid: false,
  rosterId: null,
  ...over,
});

const memberInput = (over: Partial<Parameters<typeof createMember>[0]> = {}) => ({
  company: CO,
  name: "Nour",
  role: "Designer",
  serviceLine: "branding" as const,
  account: "1234",
  salary: 500_000,
  active: true,
  from: "2026-01",
  ...over,
});

const moveInput = (over: Partial<Parameters<typeof createMove>[0]> = {}) => ({
  company: CO,
  month: M,
  kind: "deposit" as const,
  label: "Owner top-up",
  amount: 300_000,
  date: "2026-03-04",
  ...over,
});

const loanInput = (over: Partial<Parameters<typeof createLoan>[0]> = {}) => ({
  company: CO,
  direction: "borrowed" as const,
  party: "Bank Misr",
  principal: 2_000_000,
  date: "2026-03-02",
  dueDate: "2026-09-02",
  note: "",
  moveCash: true,
  ...over,
});

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

/* ==========================================================================
   1. THE ROUND TRIP — all 24 mutations, plus the payroll-linked variants
   ========================================================================== */

type Ctx = Record<string, { id: string }>;

interface Case {
  name: string;
  kind: AcctUndoKind;
  /** the EN label the entry must store — what the button will say */
  says: RegExp;
  /** rows that must exist FIRST; runs before the `before` snapshot is taken */
  setup?: (a: Actor) => Promise<Ctx>;
  act: (a: Actor, c: Ctx) => Promise<unknown>;
}

const CASES: Case[] = [
  /* ---------------------------------------------------------------- income */
  {
    name: "createIncome",
    kind: "acct_income_create",
    says: /^Added income: Acme Trading$/,
    act: (a) => createIncome(incomeInput(), a),
  },
  {
    name: "updateIncome",
    kind: "acct_income_update",
    says: /^Edited income: Beta Co$/,
    setup: async (a) => ({ inc: await createIncome(incomeInput(), a) }),
    act: (a, c) =>
      updateIncome(
        c.inc.id,
        incomeInput({ client: "Beta Co", amount: 999_99, note: "changed", collected: true }),
        a,
      ),
  },
  {
    name: "toggleIncomeCollected",
    kind: "acct_income_collect_toggle",
    says: /^Marked income collected: Acme Trading$/,
    setup: async (a) => ({ inc: await createIncome(incomeInput(), a) }),
    act: (a, c) => toggleIncomeCollected(c.inc.id, CO, a),
  },
  {
    name: "deleteIncome",
    kind: "acct_income_delete",
    says: /^Deleted income: Acme Trading$/,
    setup: async (a) => ({ inc: await createIncome(incomeInput(), a) }),
    act: (a, c) => deleteIncome(c.inc.id, CO, a),
  },
  /* -------------------------------------------------------------- expenses */
  {
    name: "createExpense",
    kind: "acct_expense_create",
    says: /^Added expense: Office rent$/,
    act: (a) => createExpense(expenseInput(), a),
  },
  {
    name: "createExpense — payroll, linked and PAID (mints an approval mark)",
    kind: "acct_expense_create",
    says: /^Added expense: Nour$/,
    setup: async (a) => ({ m: await createMember(memberInput(), a) }),
    act: (a, c) =>
      createExpense(
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          paid: true,
          rosterId: c.m.id,
        }),
        a,
      ),
  },
  {
    name: "updateExpense",
    kind: "acct_expense_update",
    says: /^Edited expense: Landlord$/,
    setup: async (a) => ({ e: await createExpense(expenseInput(), a) }),
    act: (a, c) =>
      updateExpense(
        c.e.id,
        expenseInput({ name: "Landlord", amount: 1_500_00, month: "2026-04", paid: true }),
        a,
      ),
  },
  {
    name: "updateExpense — payroll moved to ANOTHER month (transfers the mark)",
    kind: "acct_expense_update",
    says: /^Edited expense: Nour$/,
    setup: async (a) => {
      const m = await createMember(memberInput(), a);
      const e = await createExpense(
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          paid: true,
          rosterId: m.id,
        }),
        a,
      );
      return { m, e };
    },
    act: (a, c) =>
      updateExpense(
        c.e.id,
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          month: "2026-04",
          paid: true,
          rosterId: c.m.id,
        }),
        a,
      ),
  },
  {
    name: "toggleExpensePaid",
    kind: "acct_expense_paid_toggle",
    says: /^Approved expense: Office rent$/,
    setup: async (a) => ({ e: await createExpense(expenseInput(), a) }),
    act: (a, c) => toggleExpensePaid(c.e.id, CO, a),
  },
  {
    name: "toggleExpensePaid — payroll un-approved (DELETES the mark)",
    kind: "acct_expense_paid_toggle",
    says: /^Put expense back on hold: Nour$/,
    setup: async (a) => {
      const m = await createMember(memberInput(), a);
      const e = await createExpense(
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          paid: true,
          rosterId: m.id,
        }),
        a,
      );
      return { m, e };
    },
    act: (a, c) => toggleExpensePaid(c.e.id, CO, a),
  },
  {
    name: "deleteExpense",
    kind: "acct_expense_delete",
    says: /^Deleted expense: Office rent$/,
    setup: async (a) => ({ e: await createExpense(expenseInput(), a) }),
    act: (a, c) => deleteExpense(c.e.id, CO, a),
  },
  {
    name: "deleteExpense — payroll, PAID (releases the mark to the derived row)",
    kind: "acct_expense_delete",
    says: /^Deleted expense: Nour$/,
    setup: async (a) => {
      const m = await createMember(memberInput(), a);
      const e = await createExpense(
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          paid: true,
          rosterId: m.id,
        }),
        a,
      );
      return { m, e };
    },
    act: (a, c) => deleteExpense(c.e.id, CO, a),
  },
  /* --------------------------------------------------------------- payroll */
  {
    name: "togglePayrollMark — approve",
    kind: "acct_payroll_toggle",
    says: /^Approved salary: Nour — 2026-03$/,
    setup: async (a) => ({ m: await createMember(memberInput(), a) }),
    act: (a, c) => togglePayrollMark({ company: CO, memberId: c.m.id, month: M }, a),
  },
  {
    name: "togglePayrollMark — un-approve (the mark and its ORIGINAL date)",
    kind: "acct_payroll_toggle",
    says: /^Un-approved salary: Nour — 2026-03$/,
    setup: async (a) => {
      const m = await createMember(memberInput(), a);
      await togglePayrollMark({ company: CO, memberId: m.id, month: M }, a);
      return { m };
    },
    act: (a, c) => togglePayrollMark({ company: CO, memberId: c.m.id, month: M }, a),
  },
  /* ---------------------------------------------------------------- roster */
  {
    name: "createMember",
    kind: "acct_member_create",
    says: /^Added to the payroll roster: Nour$/,
    act: (a) => createMember(memberInput(), a),
  },
  {
    name: "updateMember — a raise from a later month (re-mints every segment)",
    kind: "acct_member_update",
    says: /^Edited roster member: Nour Hassan$/,
    setup: async (a) => ({ m: await createMember(memberInput(), a) }),
    act: (a, c) =>
      updateMember(
        c.m.id,
        memberInput({ name: "Nour Hassan", role: "Art Director", salary: 700_000, from: "2026-04" }),
        a,
      ),
  },
  {
    name: "toggleMemberActive",
    kind: "acct_member_toggle_active",
    says: /^(Reactivated|Deactivated) roster member: Nour$/,
    setup: async (a) => ({ m: await createMember(memberInput(), a) }),
    act: (a, c) => toggleMemberActive(c.m.id, CO, a),
  },
  {
    name: "deleteMember — segments AND marks cascade, a linked expense is SetNull'd",
    kind: "acct_member_delete",
    says: /^Removed from the payroll roster: Nour$/,
    setup: async (a) => {
      const m = await createMember(memberInput(), a);
      await togglePayrollMark({ company: CO, memberId: m.id, month: "2026-02" }, a);
      const e = await createExpense(
        expenseInput({
          type: "payroll",
          name: "",
          serviceLine: "branding",
          amount: 480_000,
          paid: false,
          rosterId: m.id,
        }),
        a,
      );
      return { m, e };
    },
    act: (a, c) => deleteMember(c.m.id, CO, a),
  },
  /* ----------------------------------------------------------------- media */
  {
    name: "mediaReceived — ledger entry + fee income + held deposit",
    kind: "acct_media_received",
    says: /^Recorded ad budget received: Zeta Ltd$/,
    act: (a) =>
      mediaReceived(
        { company: CO, month: M, client: "Zeta Ltd", amount: 1_000_000, feeAmount: 150_000, ref: "AUG" },
        a,
      ),
  },
  {
    name: "mediaSent — ledger entry + withdrawal",
    kind: "acct_media_sent",
    says: /^Recorded ad spend forwarded: Zeta Ltd$/,
    act: (a) =>
      mediaSent({ company: CO, month: M, client: "Zeta Ltd", amount: 820_000, ref: "AUG" }, a),
  },
  /* ----------------------------------------------------------------- loans */
  {
    name: "createLoan — with the cash movement",
    kind: "acct_loan_create",
    says: /^Recorded loan received: Bank Misr$/,
    act: (a) => createLoan(loanInput(), a),
  },
  {
    name: "addLoanPayment",
    kind: "acct_loan_payment",
    says: /^Recorded loan payment: Bank Misr$/,
    setup: async (a) => ({ l: await createLoan(loanInput(), a) }),
    act: (a, c) =>
      addLoanPayment(
        c.l.id,
        { company: CO, amount: 500_000, date: "2026-04-01", note: "first", moveCash: true },
        a,
      ),
  },
  {
    name: "deleteLoan — every cascaded repayment comes back too",
    kind: "acct_loan_delete",
    says: /^Deleted loan: Bank Misr$/,
    setup: async (a) => {
      const l = await createLoan(loanInput(), a);
      await addLoanPayment(
        l.id,
        { company: CO, amount: 500_000, date: "2026-04-01", note: "one", moveCash: true },
        a,
      );
      await addLoanPayment(
        l.id,
        { company: CO, amount: 250_000, date: "2026-05-01", note: "two", moveCash: false },
        a,
      );
      return { l };
    },
    act: (a, c) => deleteLoan(c.l.id, CO, a),
  },
  /* -------------------------------------------------------------- treasury */
  {
    name: "createMove",
    kind: "acct_move_create",
    says: /^Added treasury deposit: Owner top-up$/,
    act: (a) => createMove(moveInput(), a),
  },
  {
    name: "updateMove",
    kind: "acct_move_update",
    says: /^Edited treasury movement: Bank fee$/,
    setup: async (a) => ({ mv: await createMove(moveInput(), a) }),
    act: (a, c) =>
      updateMove(
        c.mv.id,
        moveInput({ kind: "withdraw", label: "Bank fee", amount: 1_500, month: "2026-04", date: "2026-04-09" }),
        a,
      ),
  },
  {
    name: "deleteMove",
    kind: "acct_move_delete",
    says: /^Deleted treasury movement: Owner top-up$/,
    setup: async (a) => ({ mv: await createMove(moveInput(), a) }),
    act: (a, c) => deleteMove(c.mv.id, CO, a),
  },
  /* -------------------------------------------------- settings and targets */
  {
    name: "setOpeningBalance — the FIRST time (no settings row existed)",
    kind: "acct_opening_balance",
    says: /^Changed the opening balance$/,
    act: (a) => setOpeningBalance({ company: CO, openingBalance: 4_000_000 }, a),
  },
  {
    name: "setOpeningBalance — changing an existing one",
    kind: "acct_opening_balance",
    says: /^Changed the opening balance$/,
    setup: async (a) => {
      await setOpeningBalance({ company: CO, openingBalance: 4_000_000 }, a);
      return {};
    },
    act: (a) => setOpeningBalance({ company: CO, openingBalance: 9_999_99 }, a),
  },
  {
    name: "setTarget — the FIRST time for this period",
    kind: "acct_target_set",
    says: /^Set the target: 2026-03$/,
    act: (a) => setTarget({ company: CO, period: M, goal: 5_000_000 }, a),
  },
  {
    name: "setTarget — raising an existing goal",
    kind: "acct_target_set",
    says: /^Set the target: 2026-03$/,
    setup: async (a) => {
      await setTarget({ company: CO, period: M, goal: 5_000_000 }, a);
      return {};
    },
    act: (a) => setTarget({ company: CO, period: M, goal: 8_000_000 }, a),
  },
  {
    name: "deleteTarget",
    kind: "acct_target_delete",
    says: /^Deleted the target: 2026-03$/,
    setup: async (a) => ({ t: await setTarget({ company: CO, period: M, goal: 5_000_000 }, a) }),
    act: (a, c) => deleteTarget(c.t.id, CO, a),
  },
];

describe("every accounting mutation records an inverse — do it, undo it, redo it", () => {
  for (const c of CASES) {
    it(`${c.name}: undo restores the WHOLE database, redo restores the action`, async () => {
      const actor = await makeUser();
      const ctx = (await c.setup?.(actor)) ?? {};

      const before = await books();
      await c.act(actor, ctx);
      const after = await books();
      /* the action did something — otherwise the round trip proves nothing */
      expect(after, `${c.name} changed nothing`).not.toEqual(before);

      const offer = await pendingAcctUndo(actor.id, CO);
      expect(offer, `${c.name} recorded no inverse`).not.toBeNull();
      expect(offer!.label).toMatch(c.says);
      expect(offer!.labelAr.length).toBeGreaterThan(0);
      /* the kind is the one this action logs, and it is acct_-prefixed */
      const entry = await db.undoEntry.findUniqueOrThrow({ where: { id: offer!.id } });
      expect(entry.kind).toBe(c.kind);
      expect(entry.kind.startsWith("acct_")).toBe(true);

      const undone = await performAcctUndo(actor, CO);
      expect(undone.label).toMatch(c.says);
      expect(await books(), `${c.name} did not restore the prior state`).toEqual(before);

      const redoOffer = await pendingAcctRedo(actor.id, CO);
      expect(redoOffer, `${c.name} offered no redo`).not.toBeNull();
      expect(redoOffer!.label).toMatch(c.says);
      /* and Undo must not offer the redo entry back to itself */
      expect(await pendingAcctUndo(actor.id, CO)).toBeNull();

      await performAcctRedo(actor, CO);
      expect(await books(), `${c.name} did not re-apply exactly`).toEqual(after);
    });
  }

  it("the table covers all 24 mutating functions", () => {
    /* a FLOOR, not a fixture: a 25th mutation may be added (and then needs its
       own row here), but a kind disappearing means a mutation stopped recording */
    expect(new Set(CASES.map((c) => c.kind)).size).toBe(24);
  });
});

/* ==========================================================================
   2. A DELETE COMES BACK WITH ITS ORIGINAL ID — and its children
   ========================================================================== */

describe("undoing a delete restores the row itself, not a copy of it", () => {
  it("income, treasury and target come back under their ORIGINAL ids", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await deleteIncome(inc.id, CO, actor);
    await performAcctUndo(actor, CO);
    const back = await db.acctIncome.findUniqueOrThrow({ where: { id: inc.id } });
    expect(back.id).toBe(inc.id);
    expect(back.createdAt.toISOString()).toBe(inc.createdAt.toISOString());
    expect(back.updatedAt.toISOString()).toBe(inc.updatedAt.toISOString());

    const mv = await createMove(moveInput(), actor);
    await deleteMove(mv.id, CO, actor);
    await performAcctUndo(actor, CO);
    expect((await db.acctTreasuryMove.findUniqueOrThrow({ where: { id: mv.id } })).id).toBe(mv.id);

    const t = await setTarget({ company: CO, period: M, goal: 5_000_000 }, actor);
    await deleteTarget(t.id, CO, actor);
    await performAcctUndo(actor, CO);
    expect(await db.acctTarget.findUniqueOrThrow({ where: { id: t.id } })).toEqual(t);
  });

  it("deleteLoan: the loan AND every cascaded repayment, each with its own id", async () => {
    const actor = await makeUser();
    const loan = await createLoan(loanInput(), actor);
    const p1 = await addLoanPayment(
      loan.id,
      { company: CO, amount: 500_000, date: "2026-04-01", note: "one", moveCash: true },
      actor,
    );
    const p2 = await addLoanPayment(
      loan.id,
      { company: CO, amount: 250_000, date: "2026-05-01", note: "two", moveCash: false },
      actor,
    );

    await deleteLoan(loan.id, CO, actor);
    expect(await db.acctLoanPayment.count()).toBe(0); // the cascade really fired

    await performAcctUndo(actor, CO);
    expect(await db.acctLoan.findUniqueOrThrow({ where: { id: loan.id } })).toEqual(loan);
    const back = await db.acctLoanPayment.findMany({ orderBy: { date: "asc" } });
    expect(back).toEqual([p1, p2]);
  });

  it("deleteMember: the person, their salary history, their approvals and the link on their override", async () => {
    const actor = await makeUser();
    const m = await createMember(memberInput(), actor);
    const seg = await db.acctRosterSegment.findMany({ where: { memberId: m.id } });
    await togglePayrollMark({ company: CO, memberId: m.id, month: "2026-02" }, actor);
    const mark = await db.acctPayrollPayment.findFirstOrThrow({ where: { memberId: m.id } });
    const override = await createExpense(
      expenseInput({
        type: "payroll",
        name: "",
        serviceLine: "branding",
        amount: 480_000,
        rosterId: m.id,
      }),
      actor,
    );

    await deleteMember(m.id, CO, actor);
    expect(await db.acctRosterSegment.count()).toBe(0);
    expect(await db.acctPayrollPayment.count()).toBe(0);
    /* the override survived, unlinked — which is the silent half of this delete */
    expect((await db.acctExpense.findUniqueOrThrow({ where: { id: override.id } })).rosterId).toBeNull();

    await performAcctUndo(actor, CO);
    expect(await db.acctRosterMember.findUniqueOrThrow({ where: { id: m.id } })).toEqual(m);
    expect(await db.acctRosterSegment.findMany({ where: { memberId: m.id } })).toEqual(seg);
    expect(await db.acctPayrollPayment.findFirstOrThrow({ where: { memberId: m.id } })).toEqual(mark);
    expect((await db.acctExpense.findUniqueOrThrow({ where: { id: override.id } })).rosterId).toBe(m.id);
  });
});

/* ==========================================================================
   3. THE FINGERPRINT — changed since means refused, never clobbered
   ========================================================================== */

describe("the fingerprint refuses rather than overwriting somebody's later edit", () => {
  it("AcctIncome (HAS updatedAt): an edit after the action blocks the undo", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await updateIncome(inc.id, incomeInput({ amount: 900_00 }), actor);

    /* somebody else edits the row — straight to the database, as another
       screen's save would */
    await db.acctIncome.update({ where: { id: inc.id }, data: { note: "theirs" } });
    const guarded = await books();

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect(await books()).toEqual(guarded);
    /* and the refusal did not spend the entry's claim — nothing was retired
       behind the founder's back, because the whole transaction rolled back */
    expect(await db.undoEntry.count({ where: { consumedAt: null } })).toBeGreaterThan(0);
  });

  it("AcctTarget (NO updatedAt): a changed goal blocks the undo", async () => {
    const actor = await makeUser();
    await setTarget({ company: CO, period: M, goal: 5_000_000 }, actor);
    await setTarget({ company: CO, period: M, goal: 8_000_000 }, actor);

    const row = await db.acctTarget.findFirstOrThrow({ where: { company: CO, period: M } });
    await db.acctTarget.update({ where: { id: row.id }, data: { goal: 1_234_567 } });

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect((await db.acctTarget.findUniqueOrThrow({ where: { id: row.id } })).goal).toBe(1_234_567);
  });

  it("AcctTarget: a DIFFERENT target at the same period blocks the undo of a delete", async () => {
    /* the hole a by-id reference would have left open: the row the undo wants to
       re-create is gone, so an id check would see "absent, as expected" and
       collide on the unique index. The natural key sees the intruder. */
    const actor = await makeUser();
    const t = await setTarget({ company: CO, period: M, goal: 5_000_000 }, actor);
    await deleteTarget(t.id, CO, actor);
    const replacement = await db.acctTarget.create({
      data: { company: CO, period: M, goal: 7_000_000 },
    });

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect(await db.acctTarget.findMany()).toEqual([replacement]);
  });

  it("AcctMediaEntry (NO updatedAt): an edited ledger entry blocks the undo", async () => {
    const actor = await makeUser();
    const entry = await mediaReceived(
      { company: CO, month: M, client: "Zeta Ltd", amount: 1_000_000, feeAmount: 150_000, ref: "AUG" },
      actor,
    );
    await db.acctMediaEntry.update({ where: { id: entry.id }, data: { ref: "SEP" } });
    const guarded = await books();

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect(await books()).toEqual(guarded);
  });

  it("AcctPayrollPayment (NO updatedAt): an edited approval date blocks the undo", async () => {
    const actor = await makeUser();
    const m = await createMember(memberInput(), actor);
    await togglePayrollMark({ company: CO, memberId: m.id, month: M }, actor);

    const mark = await db.acctPayrollPayment.findFirstOrThrow({ where: { memberId: m.id } });
    await db.acctPayrollPayment.update({ where: { id: mark.id }, data: { paidDate: "2026-03-28" } });

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect((await db.acctPayrollPayment.findUniqueOrThrow({ where: { id: mark.id } })).paidDate).toBe(
      "2026-03-28",
    );
  });

  it("AcctSettings (NO updatedAt): an edited opening balance blocks the undo", async () => {
    const actor = await makeUser();
    await setOpeningBalance({ company: CO, openingBalance: 4_000_000 }, actor);
    await db.acctSettings.update({ where: { company: CO }, data: { openingBalance: 77 } });

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/changed since/i);
    expect((await db.acctSettings.findUniqueOrThrow({ where: { company: CO } })).openingBalance).toBe(77);
  });

  it("a child added since blocks a create's undo — the cascade would eat it", async () => {
    const actor = await makeUser();
    const loan = await createLoan(loanInput(), actor);
    /* a repayment this entry has no snapshot of. Undoing the loan's creation
       would delete the loan and the payment would go with it. */
    await db.acctLoanPayment.create({
      data: { loanId: loan.id, amount: 100_000, date: "2026-04-01", note: "theirs" },
    });
    const guarded = await books();

    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Records were added/i);
    expect(await books()).toEqual(guarded);
  });

  it("ADR-058: undoing a payroll delete is refused once ANOTHER ADMIN has covered that person-month", async () => {
    /* The invariant that costs real money: two covering rows pay one salary
       twice out of one month — in the totals, the P&L, the department margins
       and the treasury alike — and the engine cannot tell them apart after the
       fact. The fingerprint cannot see this one, because the intruder is a row
       the entry's scope never named.

       And it is a REAL sequence, not a contrivance: the retire sweep is
       per-USER, so a second admin writing that covering row leaves my pending
       inverse exactly where it was. */
    const mine = await makeUser("Mine");
    const theirs = await makeUser("Theirs");
    const m = await createMember(memberInput(), mine);
    const first = await createExpense(
      expenseInput({ type: "payroll", name: "", serviceLine: "branding", amount: 480_000, rosterId: m.id }),
      mine,
    );
    await deleteExpense(first.id, CO, mine);

    await createExpense(
      expenseInput({ type: "payroll", name: "", serviceLine: "branding", amount: 510_000, rosterId: m.id }),
      theirs,
    );
    /* my inverse survived their write — which is exactly why it needs a guard */
    expect((await pendingAcctUndo(mine.id, CO))?.label).toMatch(/^Deleted expense: Nour$/);
    const guarded = await books();

    await expect(performAcctUndo(mine, CO)).rejects.toThrow(/twice/i);
    expect(await books()).toEqual(guarded);
    expect(await db.acctExpense.count({ where: { rosterId: m.id, month: M } })).toBe(1);
  });
});

/* ==========================================================================
   4. PERSONAL, PER COMPANY, ONE STEP
   ========================================================================== */

describe("personal — you can only undo what you yourself did", () => {
  it("another admin is not offered it and cannot apply it", async () => {
    const mine = await makeUser("Mine");
    const theirs = await makeUser("Theirs");
    const inc = await createIncome(incomeInput(), mine);
    const guarded = await books();

    expect(await pendingAcctUndo(theirs.id, CO)).toBeNull();
    await expect(performAcctUndo(theirs, CO)).rejects.toThrow(/Nothing to undo/);
    expect(await books()).toEqual(guarded);

    /* and mine still works, untouched by their attempt */
    expect((await pendingAcctUndo(mine.id, CO))?.label).toMatch(/Added income/);
    await performAcctUndo(mine, CO);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);
  });

  it("an actor with no id has nothing of its own — 403, not a silent success", async () => {
    const system: Actor = { id: null, label: "System" };
    await expect(performAcctUndo(system, CO)).rejects.toMatchObject({ status: 403 });
    await expect(performAcctRedo(system, CO)).rejects.toMatchObject({ status: 403 });
  });

  it("a write with no actor records nothing to undo at all (ADR-045's rule)", async () => {
    await createIncome(incomeInput(), { id: null, label: "Seed" });
    expect(await db.undoEntry.count()).toBe(0);
  });
});

describe("per company — one company's books are not undoable from the other's view", () => {
  it("an entry written in ByteForce is invisible and inapplicable in B-Systems", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    const guarded = await books();

    expect(await pendingAcctUndo(actor.id, OTHER)).toBeNull();
    await expect(performAcctUndo(actor, OTHER)).rejects.toThrow(/Nothing to undo/);
    expect(await books()).toEqual(guarded);

    expect((await pendingAcctUndo(actor.id, CO))?.id).toBeTruthy();
    await performAcctUndo(actor, CO);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);
  });

  it("writing in the other company's books quiets BOTH buttons — one person, one last action", async () => {
    /* ADR-045's honesty rule, read across the company filter. The founder has
       ONE pair of buttons in the module and ONE chronological history, so after
       a write in B-Systems the last thing he did is a B-Systems thing: offering
       the older ByteForce inverse would be offering something older than his
       last action, which is precisely what ADR-045 forbids. The COMPANY filter
       is the safety wall on top (an inverse can never be applied from the wrong
       company's view); the sweep is the honesty. */
    const actor = await makeUser();
    const bf = await createIncome(incomeInput(), actor);
    const bs = await createIncome(incomeInput({ company: OTHER, client: "Delta" }), actor);

    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    expect((await pendingAcctUndo(actor.id, OTHER))?.label).toMatch(/Delta/);
    /* and from ByteForce's view the B-Systems entry is not applicable at all */
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Nothing to undo/);
    expect(await db.acctIncome.count()).toBe(2);

    await performAcctUndo(actor, OTHER);
    expect(await db.acctIncome.count({ where: { id: bs.id } })).toBe(0);
    expect(await db.acctIncome.count({ where: { id: bf.id } })).toBe(1);

    /* the redo it just wrote belongs to B-Systems only */
    expect(await pendingAcctRedo(actor.id, CO)).toBeNull();
    expect(await pendingAcctRedo(actor.id, OTHER)).not.toBeNull();
    await expect(performAcctRedo(actor, CO)).rejects.toThrow(/Nothing to redo/);
  });
});

describe("one step, not a history stack", () => {
  it("after an undo the older entries are retired and Undo offers nothing", async () => {
    const actor = await makeUser();
    const first = await createIncome(incomeInput({ client: "First" }), actor);
    const second = await createIncome(incomeInput({ client: "Second" }), actor);

    /* the second write already retired the first's inverse */
    expect((await pendingAcctUndo(actor.id, CO))?.label).toMatch(/Second/);

    await performAcctUndo(actor, CO);
    expect(await db.acctIncome.count({ where: { id: second.id } })).toBe(0);
    expect(await db.acctIncome.count({ where: { id: first.id } })).toBe(1);

    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Nothing to undo/);
    /* the first income is still there — walking further back is not offered */
    expect(await db.acctIncome.count({ where: { id: first.id } })).toBe(1);
  });

  it("a NEW action kills the pending Redo — it cannot resurrect a row later", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await performAcctUndo(actor, CO);
    expect(await pendingAcctRedo(actor.id, CO)).not.toBeNull();

    await createMove(moveInput(), actor);
    expect(await pendingAcctRedo(actor.id, CO)).toBeNull();
    await expect(performAcctRedo(actor, CO)).rejects.toThrow(/Nothing to redo/);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);
  });

  it("Undo never offers a redo entry and Redo never offers an undo entry", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    expect(await pendingAcctUndo(actor.id, CO)).not.toBeNull();
    expect(await pendingAcctRedo(actor.id, CO)).toBeNull();
    await expect(performAcctRedo(actor, CO)).rejects.toThrow(/Nothing to redo/);

    await performAcctUndo(actor, CO);
    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    expect(await pendingAcctRedo(actor.id, CO)).not.toBeNull();
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Nothing to undo/);
  });
});

/* ==========================================================================
   5. TOGGLING, RACING, EXPIRY
   ========================================================================== */

describe("Undo and Redo toggle on one action without the data drifting", () => {
  it("three rounds on a delete whose row carries cascaded children", async () => {
    const actor = await makeUser();
    const loan = await createLoan(loanInput(), actor);
    await addLoanPayment(
      loan.id,
      { company: CO, amount: 500_000, date: "2026-04-01", note: "one", moveCash: true },
      actor,
    );
    const before = await books();
    await deleteLoan(loan.id, CO, actor);
    const after = await books();

    for (let round = 1; round <= 3; round++) {
      await performAcctUndo(actor, CO);
      expect(await books(), `round ${round}: undo`).toEqual(before);
      await performAcctRedo(actor, CO);
      expect(await books(), `round ${round}: redo`).toEqual(after);
    }
    /* and it can be left undone, exactly as it started */
    await performAcctUndo(actor, CO);
    expect(await books()).toEqual(before);
  });

  it("three rounds on an edit, and on a payroll approval with no updatedAt", async () => {
    const actor = await makeUser();
    const m = await createMember(memberInput(), actor);
    const before = await books();
    await togglePayrollMark({ company: CO, memberId: m.id, month: M }, actor);
    const after = await books();

    for (let round = 1; round <= 3; round++) {
      await performAcctUndo(actor, CO);
      expect(await books(), `round ${round}: undo`).toEqual(before);
      await performAcctRedo(actor, CO);
      expect(await books(), `round ${round}: redo`).toEqual(after);
    }
  });
});

describe("a racing double-click applies exactly once", () => {
  it("two simultaneous undos: one succeeds, one is refused, the data moves once", async () => {
    const actor = await makeUser();
    const m = await createMember(memberInput(), actor);
    const before = await books();
    await togglePayrollMark({ company: CO, memberId: m.id, month: M }, actor);

    const results = await Promise.allSettled([
      performAcctUndo(actor, CO),
      performAcctUndo(actor, CO),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const no = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(no).toHaveLength(1);

    expect(await books()).toEqual(before);
    /* exactly one redo was written — a second would mean the inverse ran twice */
    expect(await db.undoEntry.count({ where: { consumedAt: null } })).toBe(1);

    /* WHY the loser lost matters. Both presses read the entry in the same tick,
       so the loser reaches the claim and finds it taken: "already undone". The
       one answer it must NEVER give is "changed since" — that would mean it got
       past the claim, read the state the winner had already rewritten, and was
       only stopped by the fingerprint. The fingerprint IS a second line of
       defence here (it can never match after a successful inverse), but a race
       that reaches it has lost the claim-first guarantee ADR-045 relies on, and
       this is the assertion that can see that happen. */
    const reason = (no[0] as PromiseRejectedResult).reason as ApiError;
    expect(reason).toBeInstanceOf(ApiError);
    expect(reason.status).toBe(409);
    expect(reason.message).toMatch(/already undone/i);
  });

  it("two simultaneous redos behave the same way", async () => {
    const actor = await makeUser();
    await createMove(moveInput(), actor);
    const after = await books();
    await performAcctUndo(actor, CO);

    const results = await Promise.allSettled([
      performAcctRedo(actor, CO),
      performAcctRedo(actor, CO),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await books()).toEqual(after);
    expect(await db.acctTreasuryMove.count()).toBe(1);

    const reason = (results.find((r) => r.status === "rejected") as PromiseRejectedResult)
      .reason as ApiError;
    expect(reason.status).toBe(409);
    expect(reason.message).toMatch(/already redone/i);
  });
});

describe("the ten-minute window", () => {
  it("an expired entry is refused AND the stack is retired", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    const guarded = await books();

    await db.undoEntry.updateMany({
      where: { userId: actor.id },
      data: { createdAt: new Date(Date.now() - UNDO_WINDOW_MS - 60_000) },
    });

    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/too old to undo/);
    expect(await books()).toEqual(guarded);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(1);

    /* retired, so a second press is not even "too old" any more */
    expect(await db.undoEntry.count({ where: { userId: actor.id, consumedAt: null } })).toBe(0);
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Nothing to undo/);
  });

  it("the window is the SAME ten minutes the CRM's undo uses — one constant", () => {
    expect(UNDO_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

/* ==========================================================================
   6. ISOLATION FROM THE CRM'S STACK — the main integration risk
   ========================================================================== */

async function aLead(actor: Actor) {
  return createLead(
    "bsystems",
    { name: "Undo Corp", number: "0101234567", type: "cold_call", companyName: "Undo Co" },
    actor,
  );
}

describe("the accounting stack and the CRM's share a table and nothing else", () => {
  it("a pending accounting entry is NOT offered by the CRM's pill", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    expect(await pendingAcctUndo(actor.id, CO)).not.toBeNull();
    expect(await pendingUndoFor(actor.id)).toBeNull();
  });

  it("a pending accounting entry is NOT applied by performUndo", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await expect(performUndo(actor)).rejects.toThrow(/Nothing to undo/);
    /* the income is untouched, and its own undo still works afterwards */
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(1);
    await performAcctUndo(actor, CO);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);
  });

  it("a LEAD undo does not retire a pending accounting entry", async () => {
    const actor = await makeUser();
    const lead = await aLead(actor);
    const inc = await createIncome(incomeInput(), actor);
    await setArchived("bsystems", lead.id, true, actor); // an undoable CRM action

    expect(await pendingUndoFor(actor.id)).not.toBeNull();
    const mine = await pendingAcctUndo(actor.id, CO);
    expect(mine).not.toBeNull();

    await performUndo(actor); // the CRM's one-step sweep runs here
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).archived).toBe(false);

    /* the accounting entry survived it, and still applies */
    expect((await pendingAcctUndo(actor.id, CO))?.id).toBe(mine!.id);
    await performAcctUndo(actor, CO);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);
  });

  it("an accounting UNDO does not disturb a pending lead undo", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    const lead = await aLead(actor);
    await setArchived("bsystems", lead.id, true, actor);

    const crm = await pendingUndoFor(actor.id);
    expect(crm).not.toBeNull();

    await performAcctUndo(actor, CO);
    expect(await db.acctIncome.count()).toBe(0);

    /* the lead's inverse is exactly where it was, and still applies */
    expect((await pendingUndoFor(actor.id))?.id).toBe(crm!.id);
    await performUndo(actor);
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).archived).toBe(false);
  });

  it("an accounting REDO does not disturb a pending lead undo either", async () => {
    const actor = await makeUser();
    const mv = await createMove(moveInput(), actor);
    await performAcctUndo(actor, CO);
    const lead = await aLead(actor);
    await setArchived("bsystems", lead.id, true, actor);
    const crm = await pendingUndoFor(actor.id);

    await performAcctRedo(actor, CO);
    expect(await db.acctTreasuryMove.count({ where: { id: mv.id } })).toBe(1);
    expect((await pendingUndoFor(actor.id))?.id).toBe(crm!.id);
  });
});

/* ==========================================================================
   7. THE OTHER BRANCH — an action that records nothing retires the stack
   ========================================================================== */

describe("a non-undoable action retires the pending accounting stack", () => {
  it("invalidateUndo reaches accounting entries — which is what the books importer relies on", async () => {
    /* `importAccounting` REPLACES a whole company's books and calls exactly
       this. A pending inverse pointing at rows the import has just deleted must
       never be left offerable, so invalidateUndo is deliberately unscoped. */
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    expect(await pendingAcctUndo(actor.id, CO)).not.toBeNull();

    await db.$transaction(async (tx) => invalidateUndo(tx, actor));

    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    expect(await pendingAcctRedo(actor.id, CO)).toBeNull();
    await expect(performAcctUndo(actor, CO)).rejects.toThrow(/Nothing to undo/);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(1);
  });

  it("a real non-undoable CRM action (a lead delete) does the same, through the same call", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    const doomed = await aLead(actor);
    await deleteLead("bsystems", doomed.id, actor);
    expect(await pendingAcctUndo(actor.id, CO)).toBeNull();
    expect(await pendingUndoFor(actor.id)).toBeNull();
  });
});

/* ==========================================================================
   8. THE PREFIX GUARD, and the two routes
   ========================================================================== */

describe("the acct_ prefix is what separates the stacks, so writing one without it fails", () => {
  it("recordAcctUndo throws on a kind that is not acct_-prefixed", async () => {
    const actor = await makeUser();
    await expect(
      db.$transaction(async (tx) =>
        recordAcctUndo({
          tx,
          actor,
          kind: "lead_update" as AcctUndoKind, // the cast a refactor could make
          entityType: "acct_income",
          entityId: "x",
          company: CO,
          label: "x",
          labelAr: "x",
          scope: [],
        }),
      ),
    ).rejects.toThrow(/must start with "acct_"/);
    expect(await db.undoEntry.count()).toBe(0);
  });
});

describe("POST /api/accounting/undo and /redo", () => {
  const call = async (
    route: typeof undoRoute,
    user: { id: string } | null,
    body: unknown,
  ) => {
    authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);
    const res = await route(
      new Request("http://localhost/api/accounting/undo", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  };

  it("undoes, returns ok:true with both labels, then redoes", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);

    const undone = await call(undoRoute, actor, { company: CO });
    expect(undone.status).toBe(200);
    expect(undone.body.ok).toBe(true);
    expect(undone.body.label).toMatch(/^Added income: Acme Trading$/);
    expect(typeof undone.body.labelAr).toBe("string");
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(0);

    const redone = await call(redoRoute, actor, { company: CO });
    expect(redone.status).toBe(200);
    expect(redone.body.ok).toBe(true);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(1);
  });

  it("400 with nothing to undo, 400 on an unknown company, 409 on a second press", async () => {
    const actor = await makeUser();
    /* each refusal carries the machine-readable REASON beside the unchanged
       human message, so the browser never has to read the English prose */
    const emptyUndo = await call(undoRoute, actor, { company: CO });
    expect(emptyUndo.status).toBe(400);
    expect(emptyUndo.body.error).toBe("Nothing to undo");
    expect(emptyUndo.body.reason).toBe("nothing");
    const emptyRedo = await call(redoRoute, actor, { company: CO });
    expect(emptyRedo.status).toBe(400);
    expect(emptyRedo.body.error).toBe("Nothing to redo");
    expect(emptyRedo.body.reason).toBe("nothing");

    const bad = await call(undoRoute, actor, { company: "acme" });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/Unknown company/);
    expect(bad.body.reason).toBe("no_company");
    const noBody = await call(undoRoute, actor, {});
    expect(noBody.status).toBe(400);
    expect(noBody.body.reason).toBe("no_company");

    await createIncome(incomeInput(), actor);
    expect((await call(undoRoute, actor, { company: CO })).status).toBe(200);
    /* the entry is spent — pressing again is "nothing to undo", never a repeat */
    expect((await call(undoRoute, actor, { company: CO })).status).toBe(400);
  });

  it("409 when the row changed since", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await updateIncome(inc.id, incomeInput({ amount: 900_00 }), actor);
    await db.acctIncome.update({ where: { id: inc.id }, data: { note: "theirs" } });

    const res = await call(undoRoute, actor, { company: CO });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe("This changed since — undo is no longer safe");
    expect(res.body.reason).toBe("changed_since");
  });

  it("401 anonymous, 403 for an account without the Accounting module", async () => {
    /* an un-coded error still goes through the SHARED handler untouched: 401
       answers { error } exactly as it does on the other ~40 endpoints */
    const anon = await call(undoRoute, null, { company: CO });
    expect(anon.status).toBe(401);
    expect(anon.body.error).toBe("Not signed in");
    expect(anon.body.reason).toBeUndefined();
    expect(Object.keys(anon.body)).toEqual(["error"]);
    expect((await call(redoRoute, null, { company: CO })).status).toBe(401);

    const blocked = await db.user.create({
      data: {
        name: "Blocked",
        phone: `+2010777900${seq++}`,
        passwordHash: "x",
        canAccessAccounting: false,
        roles: { create: [{ role: "bsystems_admin" }] },
      },
    });
    const refused = await call(undoRoute, blocked, { company: CO });
    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain("Accounting");
    /* the module wall gets its code from WHICH guard refused, not from what it
       said — guards.ts is shared and was not touched */
    expect(refused.body.reason).toBe("not_permitted");

    /* and a non-admin never gets as far as the module flag */
    const sales = await db.user.create({
      data: {
        name: "Sales",
        phone: `+2010777901${seq++}`,
        passwordHash: "x",
        roles: { create: [{ role: "bsystems_sales" }] },
      },
    });
    expect((await call(redoRoute, sales, { company: CO })).status).toBe(403);
  });

  it("the undo of another admin's action is not reachable through the route", async () => {
    const mine = await makeUser("Mine");
    const theirs = await makeUser("Theirs");
    const inc = await createIncome(incomeInput(), mine);

    expect((await call(undoRoute, theirs, { company: CO })).status).toBe(400);
    expect(await db.acctIncome.count({ where: { id: inc.id } })).toBe(1);
  });
});

/* -------------------------------------------------------------------------- */

describe("the refusals carry real HTTP statuses, not generic failures", () => {
  it("400 nothing to undo / too old, 409 changed since, 403 no actor", async () => {
    const actor = await makeUser();
    await expect(performAcctUndo(actor, CO)).rejects.toMatchObject({ status: 400 });
    await expect(performAcctRedo(actor, CO)).rejects.toMatchObject({ status: 400 });
    await expect(performAcctUndo({ id: null, label: "System" }, CO)).rejects.toMatchObject({
      status: 403,
    });

    await createIncome(incomeInput({ client: "Gamma" }), actor);
    await db.acctIncome.updateMany({ where: { client: "Gamma" }, data: { note: "theirs" } });
    const err = await performAcctUndo(actor, CO).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(409);
    expect(await db.acctIncome.count({ where: { client: "Gamma" } })).toBe(1);

    /* the expired branch is a 400 too, and it clears the stack */
    await db.undoEntry.updateMany({
      where: { userId: actor.id },
      data: { createdAt: new Date(Date.now() - UNDO_WINDOW_MS - 1_000) },
    });
    await expect(performAcctUndo(actor, CO)).rejects.toMatchObject({ status: 400 });
  });
});

/* ==========================================================================
   9. THE REASON CODES — every refusal says WHY in a word a machine can read

   The UI used to choose its explanation by pattern-matching the English
   message above (`/pay them twice/`, `/already (undone|redone)/`, …). That
   worked and was pinned on both sides, but a reword here silently changed
   which sentence a bookkeeper read — and the double-payroll guard says "That
   person ALREADY has another payroll row…" while having applied NOTHING, which
   a careless /already/ explained as "that step was already applied": a wrong
   explanation of a refusal, on a money screen.

   So every refusal now carries a code from the closed set in
   lib/accounting/undo-reasons.ts. This block walks each refusal path for real
   and asserts the code AND the unchanged message — the engine's half of the
   contract whose other half acct-undo-redo.test.ts asserts in the browser.
   ========================================================================== */

describe("every refusal carries its machine-readable reason code", () => {
  /** the refusal this call produced, as the typed error the routes read. */
  async function refusalOf(run: () => Promise<unknown>): Promise<AcctUndoError> {
    const err = await run().then(
      () => null,
      (e: unknown) => e,
    );
    expect(err, "the call was expected to refuse and did not").toBeInstanceOf(AcctUndoError);
    return err as AcctUndoError;
  }

  it("nothing — an empty stack, in both directions", async () => {
    const actor = await makeUser();
    const undo = await refusalOf(() => performAcctUndo(actor, CO));
    expect(undo.status).toBe(400);
    expect(undo.message).toBe("Nothing to undo");
    expect(undo.reason).toBe("nothing");

    const redo = await refusalOf(() => performAcctRedo(actor, CO));
    expect(redo.status).toBe(400);
    expect(redo.message).toBe("Nothing to redo");
    expect(redo.reason).toBe("nothing");
  });

  it("no_actor — a call with no identity is a permission answer, not an empty stack", async () => {
    const err = await refusalOf(() => performAcctUndo({ id: null, label: "System" }, CO));
    expect(err.status).toBe(403);
    expect(err.reason).toBe("no_actor");
    /* the same PROSE as the empty stack, a DIFFERENT code — which is exactly
       what a text match could not tell apart */
    expect(err.message).toBe("Nothing to undo");
  });

  it("too_old — past the ten-minute window", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    await db.undoEntry.updateMany({
      where: { userId: actor.id },
      data: { createdAt: new Date(Date.now() - UNDO_WINDOW_MS - 60_000) },
    });
    const err = await refusalOf(() => performAcctUndo(actor, CO));
    expect(err.status).toBe(400);
    expect(err.message).toBe("That action is too old to undo");
    expect(err.reason).toBe("too_old");
  });

  it("changed_since — the fingerprint no longer matches", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await db.acctIncome.update({ where: { id: inc.id }, data: { note: "theirs" } });
    const err = await refusalOf(() => performAcctUndo(actor, CO));
    expect(err.status).toBe(409);
    expect(err.message).toBe("This changed since — undo is no longer safe");
    expect(err.reason).toBe("changed_since");
  });

  it("changed_since — and on the redo side too", async () => {
    const actor = await makeUser();
    const inc = await createIncome(incomeInput(), actor);
    await performAcctUndo(actor, CO);
    /* somebody re-uses the natural key the redo wants back */
    await db.acctIncome.create({
      data: { ...incomeInput(), id: inc.id, client: "Theirs" },
    });
    const err = await refusalOf(() => performAcctRedo(actor, CO));
    expect(err.status).toBe(409);
    expect(err.message).toBe("This changed since — redo is no longer safe");
    expect(err.reason).toBe("changed_since");
  });

  it("already_applied — the loser of a racing double-click", async () => {
    const actor = await makeUser();
    await createMove(moveInput(), actor);
    const both = await Promise.allSettled([
      performAcctUndo(actor, CO),
      performAcctUndo(actor, CO),
    ]);
    expect(both.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const err = (both.find((r) => r.status === "rejected") as PromiseRejectedResult)
      .reason as AcctUndoError;
    expect(err).toBeInstanceOf(AcctUndoError);
    expect(err.status).toBe(409);
    expect(err.message).toBe("That action was already undone");
    expect(err.reason).toBe("already_applied");
  });

  it("children_added — a cascade child this entry never recorded", async () => {
    const actor = await makeUser();
    const loan = await createLoan(loanInput(), actor);
    await db.acctLoanPayment.create({
      data: { loanId: loan.id, amount: 100_000, date: "2026-04-01", note: "theirs" },
    });
    const err = await refusalOf(() => performAcctUndo(actor, CO));
    expect(err.status).toBe(409);
    expect(err.message).toBe(
      "Records were added to this since — undo would delete them, so it was refused",
    );
    expect(err.reason).toBe("children_added");
  });

  it("double_payroll — the one whose prose contains the word 'already'", async () => {
    const mine = await makeUser("Mine");
    const theirs = await makeUser("Theirs");
    const m = await createMember(memberInput(), mine);
    const first = await createExpense(
      expenseInput({ type: "payroll", name: "", serviceLine: "branding", amount: 480_000, rosterId: m.id }),
      mine,
    );
    await deleteExpense(first.id, CO, mine);
    await createExpense(
      expenseInput({ type: "payroll", name: "", serviceLine: "branding", amount: 510_000, rosterId: m.id }),
      theirs,
    );

    const err = await refusalOf(() => performAcctUndo(mine, CO));
    expect(err.status).toBe(409);
    expect(err.message).toBe(
      "That person already has another payroll row for this month — undo would pay them twice",
    );
    /* THE DEFECT THIS CLOSES: the message contains "already" and nothing was
       applied at all, so the code must say double_payroll and never
       already_applied */
    expect(err.reason).toBe("double_payroll");
    expect(err.reason).not.toBe("already_applied");
  });

  it("every code the engine throws is in the closed set, and is an ApiError", async () => {
    /* the subclass is what lets handleRoute and the engine's own
       `instanceof ApiError` keep working while the routes read `.reason` */
    const actor = await makeUser();
    const err = await refusalOf(() => performAcctUndo(actor, CO));
    expect(err).toBeInstanceOf(ApiError);
    expect(ACCT_UNDO_REASONS).toContain(err.reason);
  });
});

describe("the routes carry the code without widening the shared handler", () => {
  const post = async (route: typeof undoRoute, user: { id: string } | null, body: unknown) => {
    authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);
    const res = await route(
      new Request("http://localhost/api/accounting/undo", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  };

  it("a refusal body is exactly { error, reason } — the message unchanged", async () => {
    const actor = await makeUser();
    const res = await post(undoRoute, actor, { company: CO });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body).sort()).toEqual(["error", "reason"]);
    expect(res.body.error).toBe("Nothing to undo");
    expect(res.body.reason).toBe("nothing");
  });

  it("every reason a route can answer with is one the client has copy for", async () => {
    const actor = await makeUser();
    const seen: unknown[] = [];
    /* the three refusal shapes reachable through the route in one test */
    seen.push((await post(undoRoute, actor, { company: CO })).body.reason);
    seen.push((await post(redoRoute, actor, { company: CO })).body.reason);
    seen.push((await post(undoRoute, actor, { company: "acme" })).body.reason);

    const inc = await createIncome(incomeInput(), actor);
    await db.acctIncome.update({ where: { id: inc.id }, data: { note: "theirs" } });
    seen.push((await post(undoRoute, actor, { company: CO })).body.reason);

    expect(seen).toEqual(["nothing", "nothing", "no_company", "changed_since"]);
    for (const reason of seen) expect(ACCT_UNDO_REASONS).toContain(reason);
  });

  /* THE FALLBACK, proven against a REAL route body rather than a hand-written
     one: a proxy that drops an unknown JSON field, or a browser running an
     older cached bundle, leaves the client with the message and the status
     alone — and the explanation must still be right. */
  it("the client still explains a real refusal whose code has been stripped out", async () => {
    const actor = await makeUser();

    const empty = await post(undoRoute, actor, { company: CO });
    expect(empty.body.reason).toBe("nothing");
    const { reason: _dropped, ...stripped } = empty.body;
    expect(stripped.reason).toBeUndefined();
    expect(acctUndoRefusal(empty.status, String(stripped.error), stripped.reason)).toBe(
      acct.undoRefuseNothing,
    );

    const inc = await createIncome(incomeInput(), actor);
    await db.acctIncome.update({ where: { id: inc.id }, data: { note: "theirs" } });
    const changed = await post(undoRoute, actor, { company: CO });
    expect(changed.body.reason).toBe("changed_since");
    const { reason: _also, ...noCode } = changed.body;
    expect(acctUndoRefusal(changed.status, String(noCode.error), noCode.reason)).toBe(
      acct.undoRefuseChanged,
    );
  });

  it("a SUCCESS body is untouched — no reason on the happy path", async () => {
    const actor = await makeUser();
    await createIncome(incomeInput(), actor);
    const ok = await post(undoRoute, actor, { company: CO });
    expect(ok.status).toBe(200);
    expect(Object.keys(ok.body).sort()).toEqual(["label", "labelAr", "ok"]);
  });
});
