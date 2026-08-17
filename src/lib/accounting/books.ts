import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import type { AcctBooks } from "./engine";
import { payrollKey } from "./engine";
import type { AcctCompany } from "./constants";

/* The single DB → engine bridge (ADR-052): reads one company's rows into the
   pure AcctBooks shape. The engine never sees Prisma; routes/pages never
   assemble books by hand. Payroll is DERIVED — nothing here reads salary
   "rows", only roster segments + the approval marks. */

type Dbish = Prisma.TransactionClient | typeof db;

export async function loadBooks(company: AcctCompany, client: Dbish = db): Promise<AcctBooks> {
  const [settings, members, payrollPayments, income, expenses, treasury, loans, media, targets] =
    await Promise.all([
      client.acctSettings.findUnique({ where: { company } }),
      client.acctRosterMember.findMany({
        where: { company },
        include: { segments: true },
        orderBy: { createdAt: "asc" },
      }),
      client.acctPayrollPayment.findMany({ where: { company } }),
      client.acctIncome.findMany({ where: { company }, orderBy: { createdAt: "desc" } }),
      client.acctExpense.findMany({ where: { company }, orderBy: { createdAt: "desc" } }),
      client.acctTreasuryMove.findMany({ where: { company }, orderBy: { createdAt: "desc" } }),
      client.acctLoan.findMany({
        where: { company },
        include: { payments: true },
        orderBy: { createdAt: "desc" },
      }),
      client.acctMediaEntry.findMany({ where: { company }, orderBy: { createdAt: "desc" } }),
      client.acctTarget.findMany({ where: { company } }),
    ]);

  const payrollPaid: Record<string, string> = {};
  for (const p of payrollPayments) payrollPaid[payrollKey(p.month, p.memberId)] = p.paidDate;

  return {
    openingBalance: settings?.openingBalance ?? 0,
    roster: members.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      serviceLine: r.serviceLine,
      account: r.account,
      since: r.since,
      segments: r.segments
        .map((s) => ({ from: s.from, salary: s.salary, active: s.active }))
        .sort((a, b) => (a.from < b.from ? -1 : 1)),
    })),
    income: income.map((i) => ({
      id: i.id,
      month: i.month,
      type: i.type,
      client: i.client,
      serviceLine: i.serviceLine,
      amount: i.amount,
      note: i.note,
      collected: i.collected,
      collectedDate: i.collectedDate,
      paidMonth: i.paidMonth,
    })),
    expenses: expenses.map((e) => ({
      id: e.id,
      month: e.month,
      type: e.type,
      name: e.name,
      serviceLine: e.serviceLine,
      amount: e.amount,
      deduction: e.deduction,
      bonus: e.bonus,
      note: e.note,
      paid: e.paid,
      paidDate: e.paidDate,
      rosterId: e.rosterId,
    })),
    treasury: treasury.map((t) => ({
      id: t.id,
      month: t.month,
      kind: t.kind,
      label: t.label,
      amount: t.amount,
      date: t.date,
      tag: t.tag,
    })),
    loans: loans.map((l) => ({
      id: l.id,
      direction: l.direction,
      party: l.party,
      principal: l.principal,
      date: l.date,
      dueDate: l.dueDate,
      note: l.note,
      payments: l.payments
        .map((p) => ({ id: p.id, amount: p.amount, date: p.date, note: p.note }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    })),
    mediaLedger: media.map((m) => ({
      id: m.id,
      month: m.month,
      client: m.client,
      type: m.type,
      amount: m.amount,
      feeAmount: m.feeAmount,
      date: m.date,
      ref: m.ref,
    })),
    targets: targets.map((t) => ({ period: t.period, goal: t.goal })),
    payrollPaid,
  };
}
