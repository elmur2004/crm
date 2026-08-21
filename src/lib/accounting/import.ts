import { z } from "zod";
import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { ApiError } from "@/lib/api-error";
import { MAX_PIASTERS } from "@/lib/money";
import { writeLog, type Actor } from "@/lib/services/activity";
import { invalidateUndo } from "@/lib/services/undo";
import { ACCT_COMPANIES, type AcctCompany } from "./constants";
import { dashboard, payrollKey, type AcctDashboard } from "./engine";
import { loadBooks } from "./books";
import { cairoMonth } from "./now";

/* ============================================================================
   BOOKS IMPORT (ADR-052, founder decision 4): the founder uploads the OLD
   APP'S OWN JSON EXPORT — either one company's file or the two-company
   "Export ALL companies" wrapper (worker.js / DataMenu show both shapes). No
   code ever reads Cloudflare KV.

   Fidelity rules:
   · the Zod layer mirrors the SPA's migrate() tolerance exactly — collections
     coerced to arrays, expenses predating the approval feature become Paid,
     roster members gain a synthesized segment, no-`since` members start this
     month (forward-only);
   · money is integer-EGP × 100 → piasters (lossless);
   · payroll is NEVER materialised as expense rows — only the roster, its
     segments and the payrollPaid approval marks are written; the engine
     re-derives the salary rows, so the import cannot under-count;
   · REPLACE per company, in ONE transaction (re-importing is idempotent);
   · old uid() ids are re-minted as cuids — rosterId links in expenses, the
     payrollPaid keys and income.mediaRef are REMAPPED through the id table.
     Orphan references (a deleted member's lingering key) are dropped: they
     are arithmetically neutral in the SPA (nothing resolves them).
   Money is not undoable (ADR-045) — the import consumes pending undo entries.
   ========================================================================== */

/* --------------------------------------------------------------- coercions */

/** SPA money is a number of EGP (occasionally a numeric string in hand-edited
    files — the SPA `+`-coerces everywhere). ×100 → Int piasters; garbage → 0
    (exactly what `+garbage || 0` does in the SPA); overflow refuses loudly. */
function egpToPiasters(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  if (!Number.isFinite(n)) return 0;
  const p = Math.round(n * 100);
  if (Math.abs(p) > MAX_PIASTERS) {
    throw new ApiError(400, `Amount out of range in the import file: ${n} EGP`);
  }
  return p;
}

const zStr = z.preprocess(
  (v) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : ""),
  z.string(),
);
const zStrOrNull = z.preprocess(
  (v) => (typeof v === "string" && v !== "" ? v : null),
  z.string().nullable(),
);
const zMoney = z.preprocess((v) => egpToPiasters(v), z.number().int());
const zMoneyOrNull = z.preprocess(
  (v) => (v == null ? null : egpToPiasters(v)),
  z.number().int().nullable(),
);
const zBool = z.preprocess((v) => !!v, z.boolean());
/** any collection that is not an array becomes [] (migrate()'s arr()) */
const zArr = <T extends z.ZodType>(item: T) =>
  z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(item));

/* ------------------------------------------------- entity schemas (per SPA) */

const zIncome = z.object({
  id: zStr.default(""),
  month: zStr.default(""),
  type: zStr.default("other"),
  client: zStr.default(""),
  serviceLine: zStr.default(""),
  amount: zMoney.default(0),
  note: zStr.default(""),
  collected: zBool.default(false),
  collectedDate: zStrOrNull.default(null),
  paidMonth: zStrOrNull.default(null),
  mediaRef: zStrOrNull.default(null),
});

const zExpenseRaw = z.object({
  id: zStr.default(""),
  month: zStr.default(""),
  type: zStr.default("other"),
  name: zStr.default(""),
  serviceLine: zStr.default(""),
  amount: zMoney.default(0),
  deduction: zMoneyOrNull.default(null),
  bonus: zMoneyOrNull.default(null),
  note: zStr.default(""),
  paid: zBool.default(false),
  paidDate: zStrOrNull.default(null),
  rosterId: zStrOrNull.default(null),
});
/* ADR-058 — the negative-net floor, on the ONLY path that has ever been able to
   populate deduction/bonus. `expenseAmount()` nets a payroll row (base −
   deduction + bonus) with no floor, so a legacy line whose deduction exceeds
   base + bonus is an expense that ADDS money: paid spend goes down, net profit
   up and the treasury gains cash. The write path refuses it (expenseSchema);
   a file may not smuggle one past. Refused LOUDLY and by name, the way an
   out-of-range amount already is — clamping would silently rewrite the
   founder's own historical totals, and the import's whole job is that its
   `verify` numbers reconcile against the old app. Individually negative
   components that still net ≥ 0 pass through untouched: that is exactly what
   the old app displayed for them. */
const zExpenseChecked = zExpenseRaw.superRefine((e) => {
  if (e.type !== "payroll") return;
  if (e.amount - (e.deduction ?? 0) + (e.bonus ?? 0) >= 0) return;
  throw new ApiError(
    400,
    `A payroll line in the import file has a deduction bigger than its salary plus bonus (${e.name || "unnamed"}, ${e.month || "no month"}). That line would ADD money to the books instead of spending it — fix it in the file and import again.`,
  );
});

/** migrate(): expenses that predate the approval feature count as already Paid */
const zExpense = z.preprocess(
  (v) =>
    v && typeof v === "object" && !("paid" in (v as Record<string, unknown>))
      ? { ...(v as Record<string, unknown>), paid: true }
      : v,
  zExpenseChecked,
);

const zSegment = z.object({
  from: zStr.default(""),
  salary: zMoney.default(0),
  active: z.preprocess((v) => v !== false, z.boolean()).default(true),
});

const zMember = z.object({
  id: zStr.default(""),
  name: zStr.default(""),
  role: zStr.default(""),
  serviceLine: zStr.default(""),
  account: zStr.default(""),
  since: zStrOrNull.default(null),
  salary: zMoney.default(0),
  active: z.preprocess((v) => v !== false, z.boolean()).default(true),
  segments: zArr(zSegment).default([]),
});

const zMove = z.object({
  id: zStr.default(""),
  month: zStr.default(""),
  kind: zStr.default("deposit"),
  label: zStr.default(""),
  amount: zMoney.default(0),
  date: zStr.default(""),
  tag: zStr.default(""),
});

const zLoanPayment = z.object({
  id: zStr.default(""),
  amount: zMoney.default(0),
  date: zStr.default(""),
  note: zStr.default(""),
});

const zLoan = z.object({
  id: zStr.default(""),
  direction: zStr.default("borrowed"),
  party: zStr.default(""),
  principal: zMoney.default(0),
  date: zStr.default(""),
  dueDate: zStr.default(""),
  note: zStr.default(""),
  payments: zArr(zLoanPayment).default([]),
});

const zMedia = z.object({
  id: zStr.default(""),
  month: zStr.default(""),
  client: zStr.default(""),
  type: zStr.default("received"),
  amount: zMoney.default(0),
  feeAmount: zMoneyOrNull.default(null),
  date: zStr.default(""),
  ref: zStr.default(""),
});

const zTarget = z.object({
  period: zStr.default(""),
  goal: zMoney.default(0),
});

const zPayrollPaid = z.preprocess(
  (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {}),
  z.record(zStr, z.unknown()),
);

/** one company's document — the SPA's EMPTY/migrate() shape */
const zCompanyDoc = z.object({
  openingBalance: zMoney.default(0),
  income: zArr(zIncome).default([]),
  expenses: zArr(zExpense).default([]),
  roster: zArr(zMember).default([]),
  treasury: zArr(zMove).default([]),
  loans: zArr(zLoan).default([]),
  mediaLedger: zArr(zMedia).default([]),
  targets: zArr(zTarget).default([]),
  payrollPaid: zPayrollPaid.default({}),
});
export type AcctCompanyDoc = z.infer<typeof zCompanyDoc>;

/* ----------------------------------------------------------- file detection */

export interface ParsedExport {
  companies: Array<{ company: AcctCompany; doc: AcctCompanyDoc }>;
}

/** Accepts the single-company export or the "Export ALL companies" wrapper.
    A single-company file carries no company marker, so the caller must say
    which company it belongs to. */
export function parseExportFile(raw: unknown, company: AcctCompany | null): ParsedExport {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new ApiError(400, "Not a valid accounting export file");
  }
  const obj = raw as Record<string, unknown>;
  /* founder mix-up guard: the CRM's own full-system backup looks nothing like
     an accounting export, but the person holding it deserves to be told WHAT
     they picked and where it goes instead of a generic refusal. */
  if (obj["app"] === "byteforce-bsystems-sales-platform" && "tables" in obj) {
    throw new ApiError(
      400,
      "This is the sales platform's FULL-SYSTEM backup file — restore it from the admin Backup screen, not here. Accounting wants the OLD accounting app's export (Data → Export backup (JSON) / Export ALL companies), e.g. all-companies-2026-08-17.json",
    );
  }
  const isWrapper = ACCT_COMPANIES.some(
    (c) => c in obj && typeof obj[c] === "object" && obj[c] !== null,
  );
  if (isWrapper) {
    const companies: ParsedExport["companies"] = [];
    for (const c of ACCT_COMPANIES) {
      if (c in obj && obj[c] && typeof obj[c] === "object") {
        companies.push({ company: c, doc: zCompanyDoc.parse(obj[c]) });
      }
    }
    if (companies.length === 0) throw new ApiError(400, "Not a valid accounting export file");
    return { companies };
  }
  /* single-company document — must look like the SPA's state (any known
     collection key present), otherwise refuse rather than import emptiness */
  const known = ["income", "expenses", "roster", "treasury", "loans", "mediaLedger", "targets", "openingBalance", "payrollPaid"];
  if (!known.some((k) => k in obj)) {
    throw new ApiError(400, "Not a valid accounting export file");
  }
  if (!company) {
    throw new ApiError(400, "This file holds one company's books — choose which company it belongs to");
  }
  return { companies: [{ company, doc: zCompanyDoc.parse(obj) }] };
}

/* ------------------------------------------------------------------ import */

export interface ImportCompanySummary {
  company: AcctCompany;
  counts: {
    income: number;
    expenses: number;
    roster: number;
    payrollMarks: number;
    treasury: number;
    loans: number;
    loanPayments: number;
    mediaEntries: number;
    targets: number;
  };
  /** derived reconciliation numbers to compare against the old app (piasters) */
  verify: AcctDashboard & { month: string };
}

export interface ImportSummary {
  companies: ImportCompanySummary[];
}

export async function importAccounting(
  raw: unknown,
  company: AcctCompany | null,
  actor: Actor,
): Promise<ImportSummary> {
  const parsed = parseExportFile(raw, company);
  const summaries: ImportCompanySummary[] = [];
  const month = cairoMonth();

  for (const { company: c, doc } of parsed.companies) {
    const summary = await db.$transaction(async (tx) => {
      /* REPLACE this company's books — children before parents */
      await tx.acctLoanPayment.deleteMany({ where: { loan: { company: c } } });
      await tx.acctLoan.deleteMany({ where: { company: c } });
      await tx.acctIncome.deleteMany({ where: { company: c } });
      await tx.acctExpense.deleteMany({ where: { company: c } });
      await tx.acctMediaEntry.deleteMany({ where: { company: c } });
      await tx.acctPayrollPayment.deleteMany({ where: { company: c } });
      await tx.acctRosterSegment.deleteMany({ where: { member: { company: c } } });
      await tx.acctRosterMember.deleteMany({ where: { company: c } });
      await tx.acctTreasuryMove.deleteMany({ where: { company: c } });
      await tx.acctTarget.deleteMany({ where: { company: c } });

      await tx.acctSettings.upsert({
        where: { company: c },
        update: { openingBalance: doc.openingBalance },
        create: { company: c, openingBalance: doc.openingBalance },
      });

      /* roster first (old id → new cuid map), synthesizing segments exactly
         like migrate(): no since → starts this month, forward-only */
      const memberIdMap = new Map<string, string>();
      for (const r of doc.roster) {
        const since = r.since ?? month;
        const segments =
          r.segments.length > 0
            ? r.segments.map((s) => ({ from: s.from || since, salary: s.salary, active: s.active }))
            : [{ from: since, salary: r.salary, active: r.active }];
        /* memberUpsert keeps one segment per month — deduplicate on `from`
           (last wins, matching the SPA's filter-then-concat) */
        const byFrom = new Map<string, (typeof segments)[number]>();
        for (const s of segments) byFrom.set(s.from, s);
        const created = await tx.acctRosterMember.create({
          data: {
            company: c,
            name: r.name,
            role: r.role,
            serviceLine: r.serviceLine,
            account: r.account,
            since,
            segments: { create: [...byFrom.values()] },
          },
        });
        if (r.id) memberIdMap.set(r.id, created.id);
      }

      /* payrollPaid map → approval rows ("month:oldId" → date; orphans drop) */
      let payrollMarks = 0;
      for (const [key, value] of Object.entries(doc.payrollPaid)) {
        const idx = key.indexOf(":");
        if (idx < 0) continue;
        const m = key.slice(0, idx);
        const newId = memberIdMap.get(key.slice(idx + 1));
        if (!m || !newId || typeof value !== "string" || !value) continue;
        await tx.acctPayrollPayment.upsert({
          where: { memberId_month: { memberId: newId, month: m } },
          update: { paidDate: value },
          create: { company: c, memberId: newId, month: m, paidDate: value },
        });
        payrollMarks++;
      }

      /* media entries next (income.mediaRef remaps onto them) */
      const mediaIdMap = new Map<string, string>();
      for (const m of doc.mediaLedger) {
        const created = await tx.acctMediaEntry.create({
          data: {
            company: c,
            month: m.month,
            client: m.client,
            type: m.type,
            amount: m.amount,
            feeAmount: m.feeAmount,
            date: m.date,
            ref: m.ref,
          },
        });
        if (m.id) mediaIdMap.set(m.id, created.id);
      }

      if (doc.income.length) {
        await tx.acctIncome.createMany({
          data: doc.income.map((i) => ({
            company: c,
            month: i.month,
            type: i.type,
            client: i.client,
            serviceLine: i.serviceLine,
            amount: i.amount,
            note: i.note,
            collected: i.collected,
            collectedDate: i.collectedDate,
            paidMonth: i.paidMonth,
            mediaEntryId: i.mediaRef ? (mediaIdMap.get(i.mediaRef) ?? null) : null,
          })),
        });
      }

      /* manual expenses only — the payroll rows the SPA derives at render time
         are NOT in its export's expenses array, and we never materialise them */
      if (doc.expenses.length) {
        await tx.acctExpense.createMany({
          data: doc.expenses.map((e) => ({
            company: c,
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
            rosterId: e.rosterId ? (memberIdMap.get(e.rosterId) ?? null) : null,
          })),
        });
      }

      if (doc.treasury.length) {
        await tx.acctTreasuryMove.createMany({
          data: doc.treasury.map((t) => ({
            company: c,
            month: t.month,
            kind: t.kind,
            label: t.label,
            amount: t.amount,
            date: t.date,
            tag: t.tag,
          })),
        });
      }

      let loanPayments = 0;
      for (const l of doc.loans) {
        await tx.acctLoan.create({
          data: {
            company: c,
            direction: l.direction,
            party: l.party,
            principal: l.principal,
            date: l.date,
            dueDate: l.dueDate,
            note: l.note,
            payments: {
              create: l.payments.map((p) => ({ amount: p.amount, date: p.date, note: p.note })),
            },
          },
        });
        loanPayments += l.payments.length;
      }

      /* one target per period (the SPA keeps them unique by period) */
      const targetByPeriod = new Map<string, number>();
      for (const t of doc.targets) if (t.period) targetByPeriod.set(t.period, t.goal);
      for (const [period, goal] of targetByPeriod) {
        await tx.acctTarget.create({ data: { company: c, period, goal } });
      }

      await writeLog(tx, {
        entityType: "acct_books",
        entityId: c,
        actor,
        action: "import",
        trigger: "acct_import",
      });
      /* a whole-books replacement is not undoable — retire pending undo rows */
      await invalidateUndo(tx, actor);

      const books = await loadBooks(c, tx);
      const verify = { ...dashboard(books, month, month), month };
      const summaryForCompany: ImportCompanySummary = {
        company: c,
        counts: {
          income: doc.income.length,
          expenses: doc.expenses.length,
          roster: doc.roster.length,
          payrollMarks,
          treasury: doc.treasury.length,
          loans: doc.loans.length,
          loanPayments,
          mediaEntries: doc.mediaLedger.length,
          targets: targetByPeriod.size,
        },
        verify,
      };
      return summaryForCompany;
    });
    summaries.push(summary);
  }

  return { companies: summaries };
}
