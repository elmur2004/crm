import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { ACCT_COMPANIES, type AcctCompany } from "./constants";
import { payrollKey } from "./engine";
import { cairoToday } from "./now";

/* ============================================================================
   BOOKS EXPORT (ADR-054, founder directive C "like the original project"):
   emits the ORIGINAL SPA's exact JSON shapes so files round-trip between the
   old and new systems in BOTH directions —
   · single company: the migrate() state document (roster with segments,
     expenses, income, treasury, loans+payments, mediaLedger, openingBalance,
     targets, payrollPaid keyed "YYYY-MM:memberId");
   · all companies: the { byteforce: {...}, bsystems: {...} } wrapper the
     SPA's "Export ALL companies (JSON)" writes (exportAllJson).
   Fidelity rules, each mirroring the SPA's own export rather than inventing:
   · money leaves as NUMBERS OF EGP (piasters ÷ 100 — lossless: piasters are
     integers, and the SPA `+`-coerces any numeric it reads);
   · optional fields the SPA only writes when present (deduction, bonus,
     rosterId, mediaRef, feeAmount) are OMITTED when null — exactly how its
     own rows look; nullable date fields the SPA writes explicitly
     (collectedDate, paidMonth, paidDate) stay as null;
   · roster members carry the legacy top-level salary/active pair the SPA
     keeps from creation time (engine-ignored when segments exist) — emitted
     from the EARLIEST segment, the creation-time semantics;
   · ids are our cuids: the SPA treats ids as opaque strings (uid() today),
     and payrollPaid keys / rosterId / mediaRef reference ids in the SAME
     file, so every link resolves on import — theirs or ours;
   · no _rev/_savedAt: the SPA's exportJson strips them (stripRev).
   Filenames (routes): `{company}-accounting-{YYYY-MM-DD}.json` and
   `all-companies-{YYYY-MM-DD}.json`, Cairo's today — the SPA's today().
   ========================================================================== */

type Dbish = Prisma.TransactionClient | typeof db;

const egp = (p: number): number => p / 100;
/** one company's books in the SPA's own state shape (EGP numbers) */
export type SpaExportDoc = {
  roster: unknown[];
  expenses: unknown[];
  income: unknown[];
  treasury: unknown[];
  loans: unknown[];
  mediaLedger: unknown[];
  openingBalance: number;
  targets: unknown[];
  payrollPaid: Record<string, string>;
};

export async function exportCompanyDoc(
  company: AcctCompany,
  client: Dbish = db,
): Promise<SpaExportDoc> {
  const [settings, members, payrollPayments, income, expenses, treasury, loans, media, targets] =
    await Promise.all([
      client.acctSettings.findUnique({ where: { company } }),
      client.acctRosterMember.findMany({
        where: { company },
        include: { segments: true },
        orderBy: { createdAt: "desc" },
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
      client.acctTarget.findMany({ where: { company }, orderBy: { period: "asc" } }),
    ]);

  const payrollPaid: Record<string, string> = {};
  for (const p of payrollPayments) payrollPaid[payrollKey(p.month, p.memberId)] = p.paidDate;

  return {
    roster: members.map((r) => {
      const segments = [...r.segments].sort((a, b) => (a.from < b.from ? -1 : 1));
      const first = segments[0];
      return {
        id: r.id,
        name: r.name,
        role: r.role,
        serviceLine: r.serviceLine,
        account: r.account,
        since: r.since,
        /* legacy creation-time pair the SPA keeps on the member (its engine
           reads segments whenever they exist — as they always do here) */
        salary: first ? egp(first.salary) : 0,
        active: first ? first.active : true,
        segments: segments.map((s) => ({ from: s.from, salary: egp(s.salary), active: s.active })),
      };
    }),
    expenses: expenses.map((e) => ({
      id: e.id,
      month: e.month,
      type: e.type,
      name: e.name,
      serviceLine: e.serviceLine,
      amount: egp(e.amount),
      ...(e.deduction == null ? {} : { deduction: egp(e.deduction) }),
      ...(e.bonus == null ? {} : { bonus: egp(e.bonus) }),
      note: e.note,
      paid: e.paid,
      paidDate: e.paidDate,
      ...(e.rosterId == null ? {} : { rosterId: e.rosterId }),
    })),
    income: income.map((i) => ({
      id: i.id,
      month: i.month,
      type: i.type,
      client: i.client,
      serviceLine: i.serviceLine,
      amount: egp(i.amount),
      note: i.note,
      collected: i.collected,
      collectedDate: i.collectedDate,
      paidMonth: i.paidMonth,
      ...(i.mediaEntryId == null ? {} : { mediaRef: i.mediaEntryId }),
    })),
    treasury: treasury.map((t) => ({
      id: t.id,
      month: t.month,
      kind: t.kind,
      label: t.label,
      amount: egp(t.amount),
      date: t.date,
      tag: t.tag,
    })),
    loans: loans.map((l) => ({
      id: l.id,
      direction: l.direction,
      party: l.party,
      principal: egp(l.principal),
      date: l.date,
      dueDate: l.dueDate,
      note: l.note,
      payments: [...l.payments]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ id: p.id, amount: egp(p.amount), date: p.date, note: p.note })),
    })),
    mediaLedger: media.map((m) => ({
      id: m.id,
      month: m.month,
      client: m.client,
      type: m.type,
      amount: egp(m.amount),
      ...(m.feeAmount == null ? {} : { feeAmount: egp(m.feeAmount) }),
      date: m.date,
      ref: m.ref,
    })),
    openingBalance: egp(settings?.openingBalance ?? 0),
    targets: targets.map((t) => ({ period: t.period, goal: egp(t.goal) })),
    payrollPaid,
  };
}

/** the SPA's "Export ALL companies (JSON)" wrapper */
export async function exportAllDoc(): Promise<Record<AcctCompany, SpaExportDoc>> {
  const out = {} as Record<AcctCompany, SpaExportDoc>;
  for (const c of ACCT_COMPANIES) out[c] = await exportCompanyDoc(c);
  return out;
}

/** SPA filename: `{tenant}-accounting-{YYYY-MM-DD}.json` */
export function exportFilename(company: AcctCompany): string {
  return `${company}-accounting-${cairoToday()}.json`;
}

/** SPA filename: `all-companies-{YYYY-MM-DD}.json` */
export function exportAllFilename(): string {
  return `all-companies-${cairoToday()}.json`;
}
