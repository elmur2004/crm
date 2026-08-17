import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { MAX_PIASTERS } from "@/lib/money";
import { writeLog, type Actor } from "./activity";
import { invalidateUndo } from "./undo";
import {
  ACCT_COMPANIES,
  ACCT_DEPTS,
  ACCT_EXPENSE_TYPES,
  ACCT_INCOME_TYPES,
  ACCT_LOAN_DIRECTIONS,
  ACCT_TREASURY_KINDS,
  mediaHidden,
  type AcctCompany,
} from "@/lib/accounting/constants";
import { memberUpsert, ym } from "@/lib/accounting/engine";
import { cairoMonth, cairoToday } from "@/lib/accounting/now";

/* ============================================================================
   Accounting mutations (ADR-052 Phase 2). Admin-only at the route layer; every
   write goes through here so each one carries an ActivityLog entry INSIDE its
   own transaction and consumes the actor's pending undo entries — money is
   NEVER undoable (ADR-045), so the undo button must stop offering anything
   older the moment a financial action happens.

   Amounts arrive as Int piasters (the client converts EGP with toPiasters,
   the statements pattern). Months/dates are the module's calendar strings.
   ========================================================================== */

const zMonth = z.string().regex(/^\d{4}-\d{2}$/, "Month must be YYYY-MM");
const zDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const zPiasters = z.number().int().min(0).max(MAX_PIASTERS);
export const zCompany = z.enum(ACCT_COMPANIES);
const zDept = z.enum(ACCT_DEPTS).or(z.literal(""));

async function logAndSeal(
  tx: Parameters<typeof writeLog>[0],
  actor: Actor,
  entityType: Parameters<typeof writeLog>[1]["entityType"],
  entityId: string,
  action: Parameters<typeof writeLog>[1]["action"],
  trigger: string,
): Promise<void> {
  await writeLog(tx, { entityType, entityId, actor, action, trigger });
  await invalidateUndo(tx, actor);
}

/** founder decision 5: B-Systems hides Media Buying — refuse its vocabulary */
function refuseMediaFor(company: AcctCompany, uses: boolean): void {
  if (uses && mediaHidden(company)) {
    throw new ApiError(400, "Media Buying is not available for B-Systems");
  }
}

/* ---------------------------------------------------------------- income */

export const incomeSchema = z.object({
  company: zCompany,
  month: zMonth,
  type: z.enum(ACCT_INCOME_TYPES),
  client: z.string().trim().max(200).default(""),
  serviceLine: zDept.default("other"),
  amount: zPiasters,
  note: z.string().trim().max(500).default(""),
  collected: z.boolean().default(false),
  collectedDate: zDate.nullish(),
});
export type IncomeInput = z.infer<typeof incomeSchema>;

function incomeCollectionFields(input: IncomeInput) {
  const d = input.collected ? (input.collectedDate ?? cairoToday()) : null;
  return { collected: input.collected, collectedDate: d, paidMonth: d ? ym(d) : null };
}

export async function createIncome(input: IncomeInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media_fee" || input.serviceLine === "media_fee");
  return db.$transaction(async (tx) => {
    const row = await tx.acctIncome.create({
      data: {
        company: input.company,
        month: input.month,
        type: input.type,
        client: input.client,
        serviceLine: input.serviceLine,
        amount: input.amount,
        note: input.note,
        ...incomeCollectionFields(input),
      },
    });
    await logAndSeal(tx, actor, "acct_income", row.id, "create", "acct_income_create");
    return row;
  });
}

export async function updateIncome(id: string, input: IncomeInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media_fee" || input.serviceLine === "media_fee");
  return db.$transaction(async (tx) => {
    const existing = await tx.acctIncome.findUnique({ where: { id } });
    if (!existing || existing.company !== input.company) throw new ApiError(404, "Income not found");
    const row = await tx.acctIncome.update({
      where: { id },
      data: {
        month: input.month,
        type: input.type,
        client: input.client,
        serviceLine: input.serviceLine,
        amount: input.amount,
        note: input.note,
        ...incomeCollectionFields(input),
      },
    });
    await logAndSeal(tx, actor, "acct_income", id, "update", "acct_income_update");
    return row;
  });
}

/** the ✓ toggle — collection lands cash TODAY (cash basis) or clears it */
export async function toggleIncomeCollected(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctIncome.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Income not found");
    const today = cairoToday();
    const row = await tx.acctIncome.update({
      where: { id },
      data: existing.collected
        ? { collected: false, collectedDate: null, paidMonth: null }
        : { collected: true, collectedDate: today, paidMonth: ym(today) },
    });
    await logAndSeal(tx, actor, "acct_income", id, "update", "acct_income_collect_toggle");
    return row;
  });
}

export async function deleteIncome(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctIncome.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Income not found");
    await tx.acctIncome.delete({ where: { id } });
    await logAndSeal(tx, actor, "acct_income", id, "delete", "acct_income_delete");
  });
}

/* --------------------------------------------------------------- expenses */

export const expenseSchema = z.object({
  company: zCompany,
  month: zMonth,
  type: z.enum(ACCT_EXPENSE_TYPES),
  name: z.string().trim().max(200).default(""),
  serviceLine: zDept.refine((d) => d !== "media_fee", "Not an expense department").default(""),
  amount: zPiasters,
  note: z.string().trim().max(500).default(""),
  paid: z.boolean().default(false),
  rosterId: z.string().nullish(),
});
export type ExpenseInput = z.infer<typeof expenseSchema>;

async function resolveExpenseData(
  tx: Parameters<typeof writeLog>[0],
  input: ExpenseInput,
): Promise<Record<string, unknown>> {
  /* a rosterId only means something on a payroll row for a member of the same
     company (the SPA's linked-row replacement rule) */
  let rosterId: string | null = null;
  let name = input.name;
  if (input.type === "payroll" && input.rosterId) {
    const member = await tx.acctRosterMember.findUnique({ where: { id: input.rosterId } });
    if (!member || member.company !== input.company) throw new ApiError(400, "Unknown roster member");
    rosterId = member.id;
    name = member.name; // the SPA fills the payee from the person
  }
  return {
    company: input.company,
    month: input.month,
    type: input.type,
    name,
    serviceLine: input.serviceLine,
    amount: input.amount,
    note: input.note,
    paid: input.paid,
    paidDate: input.paid ? cairoToday() : null,
    rosterId,
  };
}

export async function createExpense(input: ExpenseInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media");
  return db.$transaction(async (tx) => {
    const row = await tx.acctExpense.create({
      data: (await resolveExpenseData(tx, input)) as never,
    });
    await logAndSeal(tx, actor, "acct_expense", row.id, "create", "acct_expense_create");
    return row;
  });
}

export async function updateExpense(id: string, input: ExpenseInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media");
  return db.$transaction(async (tx) => {
    const existing = await tx.acctExpense.findUnique({ where: { id } });
    if (!existing || existing.company !== input.company) throw new ApiError(404, "Expense not found");
    const data = (await resolveExpenseData(tx, input)) as { paid: boolean; paidDate: string | null };
    /* keep the original approval date when the row was and stays paid */
    if (existing.paid && input.paid) data.paidDate = existing.paidDate;
    const row = await tx.acctExpense.update({ where: { id }, data: data as never });
    await logAndSeal(tx, actor, "acct_expense", id, "update", "acct_expense_update");
    return row;
  });
}

/** approve / put back on hold — THE cash gate */
export async function toggleExpensePaid(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctExpense.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Expense not found");
    const row = await tx.acctExpense.update({
      where: { id },
      data: existing.paid ? { paid: false, paidDate: null } : { paid: true, paidDate: cairoToday() },
    });
    await logAndSeal(
      tx,
      actor,
      "acct_expense",
      id,
      existing.paid ? "unapprove" : "approve",
      "acct_expense_paid_toggle",
    );
    return row;
  });
}

export async function deleteExpense(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctExpense.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Expense not found");
    await tx.acctExpense.delete({ where: { id } });
    await logAndSeal(tx, actor, "acct_expense", id, "delete", "acct_expense_delete");
  });
}

/* --------------------------------------------- payroll approval marks */

export const payrollMarkSchema = z.object({
  company: zCompany,
  memberId: z.string().min(1),
  month: zMonth,
});

/** flip one person-month's derived-salary approval (the SPA's payrollPaid) */
export async function togglePayrollMark(
  input: z.infer<typeof payrollMarkSchema>,
  actor: Actor,
): Promise<{ paid: boolean }> {
  return db.$transaction(async (tx) => {
    const member = await tx.acctRosterMember.findUnique({ where: { id: input.memberId } });
    if (!member || member.company !== input.company) throw new ApiError(404, "Roster member not found");
    const existing = await tx.acctPayrollPayment.findUnique({
      where: { memberId_month: { memberId: input.memberId, month: input.month } },
    });
    let paid: boolean;
    if (existing) {
      await tx.acctPayrollPayment.delete({ where: { id: existing.id } });
      paid = false;
    } else {
      await tx.acctPayrollPayment.create({
        data: {
          company: input.company,
          memberId: input.memberId,
          month: input.month,
          paidDate: cairoToday(),
        },
      });
      paid = true;
    }
    await logAndSeal(
      tx,
      actor,
      "acct_payroll_payment",
      `${input.month}:${input.memberId}`,
      paid ? "approve" : "unapprove",
      "acct_payroll_toggle",
    );
    return { paid };
  });
}

/* ----------------------------------------------------------------- roster */

export const memberSchema = z.object({
  company: zCompany,
  name: z.string().trim().min(1, "Name required").max(200),
  role: z.string().trim().max(200).default(""),
  serviceLine: zDept.refine((d) => d !== "media_fee", "Not a payroll department").default(""),
  account: z.string().trim().max(100).default(""),
  salary: zPiasters,
  active: z.boolean().default(true),
  from: zMonth,
});
export type MemberInput = z.infer<typeof memberSchema>;

export async function createMember(input: MemberInput, actor: Actor) {
  if (input.active && !(input.salary > 0)) throw new ApiError(400, "Name and salary required.");
  return db.$transaction(async (tx) => {
    const row = await tx.acctRosterMember.create({
      data: {
        company: input.company,
        name: input.name,
        role: input.role,
        serviceLine: input.serviceLine,
        account: input.account,
        since: input.from,
        segments: { create: [{ from: input.from, salary: input.salary, active: true }] },
      },
    });
    await logAndSeal(tx, actor, "acct_roster_member", row.id, "create", "acct_member_create");
    return row;
  });
}

/** effective-dated edit: identity fields update in place; salary/active apply
    FROM input.from via the engine's memberUpsert — history stays intact. */
export async function updateMember(id: string, input: MemberInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctRosterMember.findUnique({
      where: { id },
      include: { segments: true },
    });
    if (!existing || existing.company !== input.company) throw new ApiError(404, "Roster member not found");
    const segs = memberUpsert(
      {
        id,
        name: existing.name,
        role: existing.role,
        serviceLine: existing.serviceLine,
        account: existing.account,
        since: existing.since,
        segments: existing.segments.map((s) => ({ from: s.from, salary: s.salary, active: s.active })),
      },
      input.from,
      { salary: input.salary, active: input.active },
    );
    await tx.acctRosterSegment.deleteMany({ where: { memberId: id } });
    const row = await tx.acctRosterMember.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        serviceLine: input.serviceLine,
        account: input.account,
        segments: { create: segs },
      },
    });
    await logAndSeal(tx, actor, "acct_roster_member", id, "update", "acct_member_update");
    return row;
  });
}

/** the ⇄ toggle — active flips from the CURRENT month forward (SPA rule) */
export async function toggleMemberActive(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctRosterMember.findUnique({
      where: { id },
      include: { segments: true },
    });
    if (!existing || existing.company !== company) throw new ApiError(404, "Roster member not found");
    const m = cairoMonth();
    const shaped = {
      id,
      name: existing.name,
      role: existing.role,
      serviceLine: existing.serviceLine,
      account: existing.account,
      since: existing.since,
      segments: existing.segments.map((s) => ({ from: s.from, salary: s.salary, active: s.active })),
    };
    const now = shaped.segments.length
      ? shaped.segments.reduce(
          (cur, s) => (s.from <= m ? s : cur),
          { from: "", salary: 0, active: false },
        )
      : { from: "", salary: 0, active: false };
    const segs = memberUpsert(shaped, m, { active: !now.active });
    await tx.acctRosterSegment.deleteMany({ where: { memberId: id } });
    await tx.acctRosterMember.update({ where: { id }, data: { segments: { create: segs } } });
    await logAndSeal(tx, actor, "acct_roster_member", id, "update", "acct_member_toggle_active");
  });
}

export async function deleteMember(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctRosterMember.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Roster member not found");
    await tx.acctRosterMember.delete({ where: { id } }); // segments/marks cascade; expenses SetNull
    await logAndSeal(tx, actor, "acct_roster_member", id, "delete", "acct_member_delete");
  });
}

/* ------------------------------------------------------------------ media */

export const mediaReceivedSchema = z.object({
  company: zCompany,
  month: zMonth,
  client: z.string().trim().min(1, "Client and amount required.").max(200),
  amount: zPiasters.refine((v) => v > 0, "Client and amount required."),
  feeAmount: zPiasters,
  ref: z.string().trim().max(200).default(""),
});

/** the SPA's three-row atomic write: ledger entry + fee income (collected
    today) + the held remainder as a tagged treasury deposit */
export async function mediaReceived(
  input: z.infer<typeof mediaReceivedSchema>,
  actor: Actor,
) {
  refuseMediaFor(input.company, true);
  if (input.feeAmount > input.amount) throw new ApiError(400, "Fee cannot exceed the amount received");
  const today = cairoToday();
  return db.$transaction(async (tx) => {
    const entry = await tx.acctMediaEntry.create({
      data: {
        company: input.company,
        month: input.month,
        client: input.client,
        type: "received",
        amount: input.amount,
        feeAmount: input.feeAmount,
        date: today,
        ref: input.ref,
      },
    });
    await tx.acctIncome.create({
      data: {
        company: input.company,
        month: input.month,
        type: "media_fee",
        client: input.client,
        serviceLine: "media_fee",
        amount: input.feeAmount,
        note: `Media fee (${input.ref || "budget"})`,
        collected: true,
        collectedDate: today,
        paidMonth: input.month,
        mediaEntryId: entry.id,
      },
    });
    const held = input.amount - input.feeAmount;
    if (held > 0) {
      await tx.acctTreasuryMove.create({
        data: {
          company: input.company,
          month: input.month,
          kind: "deposit",
          label: `Client ad budget held — ${input.client}`,
          amount: held,
          date: today,
          tag: "media",
        },
      });
    }
    await logAndSeal(tx, actor, "acct_media_entry", entry.id, "create", "acct_media_received");
    return entry;
  });
}

export const mediaSentSchema = z.object({
  company: zCompany,
  month: zMonth,
  client: z.string().trim().min(1, "Client and amount required.").max(200),
  amount: zPiasters.refine((v) => v > 0, "Client and amount required."),
  ref: z.string().trim().max(200).default(""),
});

export async function mediaSent(input: z.infer<typeof mediaSentSchema>, actor: Actor) {
  refuseMediaFor(input.company, true);
  const today = cairoToday();
  return db.$transaction(async (tx) => {
    const entry = await tx.acctMediaEntry.create({
      data: {
        company: input.company,
        month: input.month,
        client: input.client,
        type: "sent",
        amount: input.amount,
        feeAmount: null,
        date: today,
        ref: input.ref,
      },
    });
    await tx.acctTreasuryMove.create({
      data: {
        company: input.company,
        month: input.month,
        kind: "withdraw",
        label: `Ad spend to buyer — ${input.client}`,
        amount: input.amount,
        date: today,
        tag: "media",
      },
    });
    await logAndSeal(tx, actor, "acct_media_entry", entry.id, "create", "acct_media_sent");
    return entry;
  });
}

/* ------------------------------------------------------------------ loans */

export const loanSchema = z.object({
  company: zCompany,
  direction: z.enum(ACCT_LOAN_DIRECTIONS),
  party: z.string().trim().min(1, "Party and amount required.").max(200),
  principal: zPiasters.refine((v) => v > 0, "Party and amount required."),
  date: zDate,
  dueDate: zDate.or(z.literal("")).default(""),
  note: z.string().trim().max(500).default(""),
  moveCash: z.boolean().default(true),
});

export async function createLoan(input: z.infer<typeof loanSchema>, actor: Actor) {
  return db.$transaction(async (tx) => {
    const loan = await tx.acctLoan.create({
      data: {
        company: input.company,
        direction: input.direction,
        party: input.party,
        principal: input.principal,
        date: input.date,
        dueDate: input.dueDate,
        note: input.note,
      },
    });
    if (input.moveCash) {
      const borrowed = input.direction === "borrowed";
      await tx.acctTreasuryMove.create({
        data: {
          company: input.company,
          month: ym(input.date),
          kind: borrowed ? "deposit" : "withdraw",
          label: borrowed ? `Loan received — ${input.party}` : `Loan given — ${input.party}`,
          amount: input.principal,
          date: input.date,
          tag: "loan",
        },
      });
    }
    await logAndSeal(tx, actor, "acct_loan", loan.id, "create", "acct_loan_create");
    return loan;
  });
}

export const loanPaymentSchema = z.object({
  company: zCompany,
  amount: zPiasters.refine((v) => v > 0, "Amount required."),
  date: zDate,
  note: z.string().trim().max(500).default(""),
  moveCash: z.boolean().default(true),
});

export async function addLoanPayment(
  loanId: string,
  input: z.infer<typeof loanPaymentSchema>,
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const loan = await tx.acctLoan.findUnique({ where: { id: loanId } });
    if (!loan || loan.company !== input.company) throw new ApiError(404, "Loan not found");
    const payment = await tx.acctLoanPayment.create({
      data: { loanId, amount: input.amount, date: input.date, note: input.note },
    });
    if (input.moveCash) {
      const borrowed = loan.direction === "borrowed";
      await tx.acctTreasuryMove.create({
        data: {
          company: input.company,
          month: ym(input.date),
          kind: borrowed ? "withdraw" : "deposit",
          label: borrowed ? `Loan repayment — ${loan.party}` : `Loan collected — ${loan.party}`,
          amount: input.amount,
          date: input.date,
          tag: "loan",
        },
      });
    }
    await logAndSeal(tx, actor, "acct_loan_payment", payment.id, "create", "acct_loan_payment");
    return payment;
  });
}

export async function deleteLoan(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctLoan.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Loan not found");
    await tx.acctLoan.delete({ where: { id } }); // payments cascade
    await logAndSeal(tx, actor, "acct_loan", id, "delete", "acct_loan_delete");
  });
}

/* --------------------------------------------------------------- treasury */

export const moveSchema = z.object({
  company: zCompany,
  month: zMonth,
  kind: z.enum(ACCT_TREASURY_KINDS),
  label: z.string().trim().max(200).default(""),
  amount: zPiasters.refine((v) => v > 0, "Amount required."),
  date: zDate,
});
export type MoveInput = z.infer<typeof moveSchema>;

export async function createMove(input: MoveInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const row = await tx.acctTreasuryMove.create({
      data: {
        company: input.company,
        month: input.month,
        kind: input.kind,
        label: input.label,
        amount: input.amount,
        date: input.date,
        tag: "",
      },
    });
    await logAndSeal(tx, actor, "acct_treasury_move", row.id, "create", "acct_move_create");
    return row;
  });
}

export async function updateMove(id: string, input: MoveInput, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctTreasuryMove.findUnique({ where: { id } });
    if (!existing || existing.company !== input.company) throw new ApiError(404, "Movement not found");
    const row = await tx.acctTreasuryMove.update({
      where: { id },
      data: {
        month: input.month,
        kind: input.kind,
        label: input.label,
        amount: input.amount,
        date: input.date,
      },
    });
    await logAndSeal(tx, actor, "acct_treasury_move", id, "update", "acct_move_update");
    return row;
  });
}

export async function deleteMove(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctTreasuryMove.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Movement not found");
    await tx.acctTreasuryMove.delete({ where: { id } });
    await logAndSeal(tx, actor, "acct_treasury_move", id, "delete", "acct_move_delete");
  });
}

export const openingSchema = z.object({ company: zCompany, openingBalance: zPiasters });

export async function setOpeningBalance(
  input: z.infer<typeof openingSchema>,
  actor: Actor,
) {
  return db.$transaction(async (tx) => {
    const row = await tx.acctSettings.upsert({
      where: { company: input.company },
      update: { openingBalance: input.openingBalance },
      create: { company: input.company, openingBalance: input.openingBalance },
    });
    await logAndSeal(tx, actor, "acct_settings", input.company, "update", "acct_opening_balance");
    return row;
  });
}

/* ---------------------------------------------------------------- targets */

export const targetSchema = z.object({
  company: zCompany,
  period: zMonth,
  goal: zPiasters.refine((v) => v > 0, "Goal required."),
});

export async function setTarget(input: z.infer<typeof targetSchema>, actor: Actor) {
  return db.$transaction(async (tx) => {
    const row = await tx.acctTarget.upsert({
      where: { company_period: { company: input.company, period: input.period } },
      update: { goal: input.goal },
      create: { company: input.company, period: input.period, goal: input.goal },
    });
    await logAndSeal(tx, actor, "acct_target", row.id, "update", "acct_target_set");
    return row;
  });
}

export async function deleteTarget(id: string, company: AcctCompany, actor: Actor) {
  return db.$transaction(async (tx) => {
    const existing = await tx.acctTarget.findUnique({ where: { id } });
    if (!existing || existing.company !== company) throw new ApiError(404, "Target not found");
    await tx.acctTarget.delete({ where: { id } });
    await logAndSeal(tx, actor, "acct_target", id, "delete", "acct_target_delete");
  });
}
