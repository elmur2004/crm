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
import { memberAt, memberUpsert, ym } from "@/lib/accounting/engine";
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

export const expenseSchema = z
  .object({
    company: zCompany,
    month: zMonth,
    type: z.enum(ACCT_EXPENSE_TYPES),
    name: z.string().trim().max(200).default(""),
    serviceLine: zDept.refine((d) => d !== "media_fee", "Not an expense department").default(""),
    amount: zPiasters,
    /* ADR-058 — a ONE-MONTH payroll adjustment. The engine's expenseAmount()
       nets them (base − deduction + bonus); both stay NULL when blank so the
       export keeps omitting the keys the old app never wrote. */
    deduction: zPiasters.nullish(),
    bonus: zPiasters.nullish(),
    note: z.string().trim().max(500).default(""),
    paid: z.boolean().default(false),
    rosterId: z.string().nullish(),
  })
  /* the SPA had no floor here: a fat-fingered deduction made the row's NET
     negative, which turns an expense into income — paid spend goes DOWN, net
     profit UP and the treasury GAINS cash. Refused server-side. */
  .refine(
    (v) =>
      v.type !== "payroll" || v.amount - (v.deduction ?? 0) + (v.bonus ?? 0) >= 0,
    { message: "A deduction cannot be larger than the salary plus the bonus.", path: ["deduction"] },
  );
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
    /* ADR-058 — written on EVERY create AND update, so an edit is authoritative
       (the founder must be able to clear a deduction). `?? null` keeps a real 0
       as 0; a blank field arrives as null and the export keeps omitting it.
       Only payroll carries them — a stray value can never ride a rent row. */
    deduction: input.type === "payroll" ? (input.deduction ?? null) : null,
    bonus: input.type === "payroll" ? (input.bonus ?? null) : null,
    note: input.note,
    paid: input.paid,
    paidDate: input.paid ? cairoToday() : null,
    rosterId,
  };
}

/* ---------------------------------------------------------------------------
   ADR-058 — THE SINGLE-OWNER APPROVAL INVARIANT.

   One person-month's payroll approval has exactly ONE owner:
     · while the salary is DERIVED from the roster — the AcctPayrollPayment mark
       (engine payrollKey "{month}:{memberId}", toggled from the auto row's ✓);
     · while a LINKED MANUAL payroll expense covers that person-month — that
       expense's own paid / paidDate (the auto row is suppressed entirely by
       autoPayroll's `covered` set, so it contributes no row and no money).

   So the mark is kept as a SHADOW of the covering expense for as long as one
   covers. The instant coverage ends — deleted, or moved to another month,
   another person, another type — the derived row that comes back already
   carries the right approval and its ORIGINAL date. Ownership is transferred on
   every boundary crossing, never dropped and never duplicated: an approval
   cannot silently vanish (a month would gain a salary's worth of cash) and
   cannot silently appear (a month would lose one).

   ACQUIRING coverage therefore never DESTROYS an approval it is not replacing.
   Only the founder un-approves: the ✓ on the covering row, or its Status set
   back to On hold in the Edit modal. Everything else — creating a row over a
   person-month, moving one onto or off one — leaves any mark already on record
   exactly where it is: PARKED. A parked mark is provably inert while coverage
   lasts (`autoPayroll`'s `covered` set drops the derived row entirely, so the
   map is never read for that person-month — the dormant-mark equivalence test
   compares every total, to the piaster), and it is what the derived row is
   restored from when coverage ends. Before this rule an unpaid create wiped the
   mark and the delete could not rebuild it: a whole approved salary left the
   month's paid spend and re-appeared as treasury cash, unrecoverably.

   The SPA had no transfer at all: creating a linked row orphaned the mark, and
   deleting it resurrected the derived row from whatever the orphan last said,
   possibly months stale. This is a deliberate correction, not a port.
   ------------------------------------------------------------------------- */
type PayrollShadow = {
  company: string;
  type: string;
  month: string;
  rosterId: string | null;
  paid: boolean;
  paidDate: string | null;
};

/** Does the ROSTER actually post a salary for this person-month? A covering row
    for a month the roster does not pay (inactive, or before the person's first
    segment) has no derived row to hand an approval back to, so a mark written
    there is an orphan — and making that person active over that month later
    would materialise an already-approved salary nobody ticked. */
async function rosterPostsSalary(
  tx: Parameters<typeof writeLog>[0],
  memberId: string,
  month: string,
): Promise<boolean> {
  const member = await tx.acctRosterMember.findUnique({
    where: { id: memberId },
    include: { segments: true },
  });
  if (!member) return false;
  const at = memberAt(member, month);
  return at.active && at.salary > 0;
}

async function shadowPayrollMark(
  tx: Parameters<typeof writeLog>[0],
  row: PayrollShadow,
  /** the founder DELIBERATELY un-approved this covering row (its ✓, or Status →
      On hold). The ONLY way a mark is ever deleted. */
  opts: { unapprove?: boolean } = {},
): Promise<void> {
  if (row.type !== "payroll" || !row.rosterId) return; // unlinked = extra on top
  const memberId = row.rosterId;
  if (row.paid) {
    if (!(await rosterPostsSalary(tx, memberId, row.month))) return; // no orphans
    await tx.acctPayrollPayment.upsert({
      where: { memberId_month: { memberId, month: row.month } },
      create: {
        company: row.company,
        memberId,
        month: row.month,
        paidDate: row.paidDate ?? cairoToday(),
      },
      /* an approval already on record keeps ITS OWN date — the day that
         person-month was approved, never the day an override was typed */
      update: {},
    });
  } else if (opts.unapprove) {
    await tx.acctPayrollPayment.deleteMany({ where: { memberId, month: row.month } });
  }
}

/* ADR-058 — ONE covering row per person-month. `autoPayroll`'s `covered` set
   drops the DERIVED row once, but `monthExpenses` emits every stored row, so a
   second linked payroll row for the same (person, month) would pay that person
   twice out of one month — in the totals, the P&L, the department margins and
   the treasury alike. The engine cannot tell the two apart after the fact; the
   write path refuses the second one, naming the row that already exists. */
async function refuseSecondCoveringRow(
  tx: Parameters<typeof writeLog>[0],
  input: ExpenseInput,
  rosterId: string | null,
  selfId: string | null,
): Promise<void> {
  if (input.type !== "payroll" || !rosterId) return;
  const clash = await tx.acctExpense.findFirst({
    where: {
      company: input.company,
      type: "payroll",
      rosterId,
      month: input.month,
      ...(selfId ? { id: { not: selfId } } : {}),
    },
  });
  if (clash) {
    throw new ApiError(
      400,
      `${clash.name || "That person"} already has a payroll row for ${input.month} — edit that row instead of adding a second one.`,
    );
  }
}

export async function createExpense(input: ExpenseInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media");
  return db.$transaction(async (tx) => {
    const data = await resolveExpenseData(tx, input);
    await refuseSecondCoveringRow(tx, input, data.rosterId as string | null, null);
    const row = await tx.acctExpense.create({ data: data as never });
    /* a create ACQUIRES coverage — it may write the approval it is carrying,
       never destroy one it found (that is the founder's ✓ to give up) */
    await shadowPayrollMark(tx, row);
    await logAndSeal(tx, actor, "acct_expense", row.id, "create", "acct_expense_create");
    return row;
  });
}

export async function updateExpense(id: string, input: ExpenseInput, actor: Actor) {
  refuseMediaFor(input.company, input.type === "media");
  return db.$transaction(async (tx) => {
    const existing = await tx.acctExpense.findUnique({ where: { id } });
    if (!existing || existing.company !== input.company) throw new ApiError(404, "Expense not found");
    const data = (await resolveExpenseData(tx, input)) as {
      paid: boolean;
      paidDate: string | null;
      rosterId: string | null;
    };
    /* keep the original approval date when the row was and stays paid */
    if (existing.paid && input.paid) data.paidDate = existing.paidDate;
    await refuseSecondCoveringRow(tx, input, data.rosterId, id);
    const row = await tx.acctExpense.update({ where: { id }, data: data as never });
    /* ADR-058 — if this row stops covering the person-month it used to cover
       (moved month, moved person, or no longer payroll), hand that approval
       back to the derived row with the state THIS row was carrying; then
       shadow whatever it covers now. */
    const stillCovers =
      existing.type === "payroll" &&
      existing.rosterId !== null &&
      row.type === "payroll" &&
      row.rosterId === existing.rosterId &&
      row.month === existing.month;
    if (!stillCovers) await shadowPayrollMark(tx, existing);
    /* the ONE un-approval an edit can express: this row still covers the same
       person-month and its Status went Paid → On hold. Any other shape of edit
       acquires coverage and leaves a mark already on record parked. */
    await shadowPayrollMark(tx, row, {
      unapprove: stillCovers && existing.paid && !row.paid,
    });
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
    /* ADR-058 — the shadow tracks the toggle too, and THIS is the deliberate
       un-approval: the founder clicked the ✓ off himself */
    await shadowPayrollMark(tx, row, { unapprove: true });
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
    /* ADR-058 — the derived roster row comes back for this month; it must come
       back with the approval this row was carrying. Redundant while the shadow
       holds, and deliberately explicit anyway: a row IMPORTED from the old app
       never had a shadow written, and deleting it must not lose its approval
       (nothing cascades here — AcctPayrollPayment cascades on the MEMBER).
       A release never un-approves: an unpaid row leaves whatever was parked
       before it took over, which is precisely the state it interrupted. */
    await shadowPayrollMark(tx, existing);
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
