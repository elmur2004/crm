/* ============================================================================
   ACCOUNTING ENGINE (ADR-052) — pure, framework-free.

   A typed re-implementation of the reference SPA's core functions (the SPA is
   the spec — docs/INTEGRATION-PLAN.md §2): incomeMonth, expenseAmount,
   memberAt / memberUpsert effective dating, autoPayroll, monthExpenses,
   treasuryThrough / liveTreasury, loanTotals, clientAccounts, P&L and
   departments. Arithmetic is mirrored exactly, at Int piaster scale (EGP ×100
   — lossless). Months are "YYYY-MM" strings compared lexicographically; dates
   are "YYYY-MM-DD" strings; nothing here touches a Date except through the
   caller-supplied `currentMonth` (the SPA's thisMonth()), which is a PARAMETER
   so every function stays deterministic and unit-testable.

   The business rules these functions ARE:
   · cash basis — income counts in the month the cash lands (paidMonth ||
     ym(collectedDate) || month), never the issue month;
   · approval gates cash — an expense on hold (paid=false) never touches
     profit or treasury; the sum of on-hold rows is accounts payable;
   · payroll is DERIVED — each active roster segment posts a salary row per
     month at read time; a manual payroll expense LINKED to a person replaces
     that person's auto row for that month; an UNLINKED one adds on top;
   · media is pass-through — only the agency fee is income; the held budget
     moves through treasury and never touches profit;
   · loans never touch profit — only cash (treasury) and the balance owed;
     outstanding ≤ 50 piasters counts as settled;
   · treasury(month) = opening + Σ net(month) + Σ (deposits − withdrawals).
   ========================================================================== */

import { ACCT_LOAN_EPSILON_PIASTERS } from "./constants";

/* ------------------------------------------------------------------ shapes */
/* Field-for-field the SPA's state arrays (amounts in piasters). The DB rows
   map 1:1 onto these; the engine never sees Prisma. */

export interface AcctSegment {
  from: string; // "YYYY-MM"
  salary: number; // piasters
  active: boolean;
}

export interface AcctMember {
  id: string;
  name: string;
  role: string;
  serviceLine: string;
  account: string;
  since: string; // "YYYY-MM"
  segments: AcctSegment[];
}

export interface AcctIncomeRow {
  id: string;
  month: string;
  type: string;
  client: string;
  serviceLine: string;
  amount: number;
  note: string;
  collected: boolean;
  collectedDate: string | null;
  paidMonth: string | null;
}

export interface AcctExpenseRow {
  id: string;
  month: string;
  type: string;
  name: string;
  serviceLine: string;
  amount: number;
  deduction: number | null;
  bonus: number | null;
  note: string;
  paid: boolean;
  paidDate: string | null;
  rosterId: string | null;
  /** true only on rows the ENGINE derived from the roster — never stored */
  auto?: boolean;
}

export interface AcctMoveRow {
  id: string;
  month: string;
  kind: string; // deposit | withdraw
  label: string;
  amount: number;
  date: string;
  tag: string;
}

export interface AcctLoanPaymentRow {
  id: string;
  amount: number;
  date: string;
  note: string;
}

export interface AcctLoanRow {
  id: string;
  direction: string; // borrowed | lent
  party: string;
  principal: number;
  date: string;
  dueDate: string;
  note: string;
  payments: AcctLoanPaymentRow[];
}

export interface AcctMediaRow {
  id: string;
  month: string;
  client: string;
  type: string; // received | sent
  amount: number;
  feeAmount: number | null;
  date: string;
  ref: string;
}

export interface AcctTargetRow {
  period: string; // "YYYY-MM"
  goal: number;
}

/** One company's complete books — what every engine function reads. */
export interface AcctBooks {
  openingBalance: number;
  roster: AcctMember[];
  expenses: AcctExpenseRow[];
  income: AcctIncomeRow[];
  treasury: AcctMoveRow[];
  loans: AcctLoanRow[];
  mediaLedger: AcctMediaRow[];
  targets: AcctTargetRow[];
  /** `${month}:${memberId}` → approval date — the SPA's payrollPaid map */
  payrollPaid: Record<string, string>;
}

/* ------------------------------------------------------------ month helpers */

export const ym = (date: string | null | undefined): string => (date ?? "").slice(0, 7);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y! * 12 + (m! - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/* ------------------------------------------------------------- core amounts */

/** cash basis: the month an income item counts in (when collected). */
export const incomeMonth = (i: AcctIncomeRow): string =>
  i.paidMonth || ym(i.collectedDate) || i.month;

/** payroll net = base − deduction + bonus; everything else is its amount. */
export const expenseAmount = (e: AcctExpenseRow): number =>
  e.type === "payroll" ? e.amount - (e.deduction ?? 0) + (e.bonus ?? 0) : e.amount;

export const isPaid = (e: AcctExpenseRow): boolean => e.paid;

/* --------------------------------------------- effective-dated roster (SPA) */

const sortSegs = (segs: AcctSegment[]): AcctSegment[] =>
  segs.slice().sort((a, b) => (a.from < b.from ? -1 : 1));

/** the salary/active values in force for member r during month m — the latest
    segment whose `from` ≤ m; before any segment the member does not exist. */
export function memberAt(r: AcctMember, m: string): { salary: number; active: boolean } {
  let cur: AcctSegment | null = null;
  for (const s of sortSegs(r.segments)) if (s.from <= m) cur = s;
  return cur ? { salary: cur.salary, active: cur.active } : { salary: 0, active: false };
}

/** upsert an effective-dated change at month m — earlier months untouched;
    a same-month segment is replaced (SPA memberUpsert). Returns new segments. */
export function memberUpsert(
  r: AcctMember,
  m: string,
  patch: { salary?: number | null; active?: boolean | null },
): AcctSegment[] {
  const at = memberAt(r, m);
  const seg: AcctSegment = {
    from: m,
    salary: patch.salary != null ? patch.salary : at.salary,
    active: patch.active != null ? patch.active : at.active,
  };
  return sortSegs(r.segments.filter((s) => s.from !== m).concat([seg]));
}

/* ------------------------------------------------------------- auto payroll */

export const payrollKey = (m: string, memberId: string): string => `${m}:${memberId}`;

/** Derive the month's salary rows from the roster. A manual payroll expense
    LINKED to a person (rosterId) replaces that person's auto row; approval
    state comes from the payrollPaid map. NEVER materialised as stored rows. */
export function autoPayroll(books: AcctBooks, m: string): AcctExpenseRow[] {
  const covered = new Set(
    books.expenses
      .filter((e) => e.type === "payroll" && e.month === m && e.rosterId)
      .map((e) => e.rosterId as string),
  );
  const rows: AcctExpenseRow[] = [];
  for (const r of books.roster) {
    if (covered.has(r.id)) continue; // manual linked row replaces the auto one
    const { salary, active } = memberAt(r, m);
    if (!active || !(salary > 0)) continue;
    const key = payrollKey(m, r.id);
    const pd = books.payrollPaid[key];
    rows.push({
      id: `pay:${key}`,
      auto: true,
      rosterId: r.id,
      type: "payroll",
      month: m,
      name: r.name,
      serviceLine: r.serviceLine || "",
      amount: salary,
      deduction: null,
      bonus: null,
      note: "Salary (from roster)",
      paid: !!pd,
      paidDate: pd ?? null,
    });
  }
  return rows;
}

/** all expense rows (manual + derived payroll) belonging to one month */
export const monthExpenses = (books: AcctBooks, m: string): AcctExpenseRow[] => [
  ...books.expenses.filter((e) => e.month === m),
  ...autoPayroll(books, m),
];

/** every month that could carry an expense, bounded by `currentMonth`
    (roster members post salaries from their first segment through today). */
export function expenseMonths(books: AcctBooks, currentMonth: string): string[] {
  const set = new Set<string>();
  for (const e of books.expenses) set.add(e.month);
  for (const k of Object.keys(books.payrollPaid)) set.add(k.split(":")[0]!);
  for (const r of books.roster) {
    let m = r.segments.map((s) => s.from).sort()[0] ?? currentMonth;
    let guard = 0;
    while (m <= currentMonth && guard++ < 600) {
      set.add(m);
      m = addMonths(m, 1);
    }
  }
  return [...set].filter(Boolean);
}

const expenseRowsWhere = (
  books: AcctBooks,
  currentMonth: string,
  pred: (m: string) => boolean,
): AcctExpenseRow[] =>
  expenseMonths(books, currentMonth)
    .filter(pred)
    .flatMap((m) => monthExpenses(books, m));

/* ------------------------------------------------------------ month figures */

/** collected income landing in month m (cash basis) */
export const incomeIn = (books: AcctBooks, m: string): number =>
  books.income
    .filter((i) => i.collected && incomeMonth(i) === m)
    .reduce((s, i) => s + i.amount, 0);

export const paidExpenseIn = (books: AcctBooks, m: string): number =>
  monthExpenses(books, m).filter(isPaid).reduce((s, e) => s + expenseAmount(e), 0);

export const pendingExpenseIn = (books: AcctBooks, m: string): number =>
  monthExpenses(books, m)
    .filter((e) => !isPaid(e))
    .reduce((s, e) => s + expenseAmount(e), 0);

/** only PAID expenses hit cash & profit (the approval gate) */
export const expenseIn = paidExpenseIn;

/** accounts payable: every on-hold expense across all months */
export const apTotal = (books: AcctBooks, currentMonth: string): number =>
  expenseRowsWhere(books, currentMonth, () => true)
    .filter((e) => !isPaid(e))
    .reduce((s, e) => s + expenseAmount(e), 0);

/** accounts receivable: every uncollected income item across all months */
export const arTotal = (books: AcctBooks): number =>
  books.income.filter((i) => !i.collected).reduce((s, i) => s + i.amount, 0);

/** month net profit (cash basis) */
export const netIn = (books: AcctBooks, m: string): number =>
  incomeIn(books, m) - expenseIn(books, m);

/* ---------------------------------------------------------------- treasury */

/** every month with any activity, sorted, ≤ upto. NOTE (mirrors the SPA
    exactly): months that carry ONLY derived payroll are not in this list —
    a roster salary alone affects treasury only once something (its approval
    mark, an expense, an income, a move) lands in that month. */
export const activeMonths = (books: AcctBooks, upto: string): string[] =>
  [
    ...new Set(
      [
        ...books.income.map(incomeMonth),
        ...books.expenses.map((e) => e.month),
        ...books.treasury.map((t) => t.month),
        ...Object.keys(books.payrollPaid).map((k) => k.split(":")[0]!),
      ].filter(Boolean),
    ),
  ]
    .filter((m) => m <= upto)
    .sort();

/** treasury balance through the END of month `upto`
    = opening + Σ net(month) + Σ (deposits − withdrawals) */
export function treasuryThrough(books: AcctBooks, upto: string): number {
  let bal = books.openingBalance;
  for (const m of activeMonths(books, upto)) {
    bal += netIn(books, m);
    for (const t of books.treasury)
      if (t.month === m) bal += t.kind === "deposit" ? t.amount : -t.amount;
  }
  return bal;
}

/** the latest month with any activity, or the current month — the "now" edge */
export function liveMonth(books: AcctBooks, currentMonth: string): string {
  const ms = activeMonths(books, "9999-99");
  const last = ms.length ? ms[ms.length - 1]! : currentMonth;
  return last > currentMonth ? last : currentMonth;
}

/** cash on hand RIGHT NOW — independent of the viewed month */
export const liveTreasury = (books: AcctBooks, currentMonth: string): number =>
  treasuryThrough(books, liveMonth(books, currentMonth));

/* -------------------------------------------------------------------- loans */

export const loanPaid = (l: AcctLoanRow): number =>
  l.payments.reduce((s, p) => s + p.amount, 0);

export const loanOutstanding = (l: AcctLoanRow): number =>
  Math.max(0, l.principal - loanPaid(l));

/** settled within ε = 50 piasters (the SPA's 0.5 EGP) */
export const loanSettled = (l: AcctLoanRow): boolean =>
  loanOutstanding(l) <= ACCT_LOAN_EPSILON_PIASTERS;

export function loanTotals(books: AcctBooks): { owe: number; owed: number; net: number } {
  const owe = books.loans
    .filter((l) => l.direction === "borrowed")
    .reduce((s, l) => s + loanOutstanding(l), 0);
  const owed = books.loans
    .filter((l) => l.direction === "lent")
    .reduce((s, l) => s + loanOutstanding(l), 0);
  return { owe, owed, net: owed - owe };
}

/* ---------------------------------------------- client accounts (A/R ledger) */

export interface AcctClientLine {
  date: string;
  kind: "invoice" | "payment" | "ad_in" | "ad_out";
  debit: number;
  credit: number;
  held?: number;
  /** income type id (invoice line) — the UI translates it */
  desc: string;
  note: string;
  running?: number;
}

export interface AcctClientAccount {
  client: string;
  invoiced: number;
  collected: number;
  held: number;
  balance: number;
  lines: AcctClientLine[];
}

/** Derived A/R sub-ledger: an income item issued to a client debits them; its
    collection credits them. Balance = invoiced − collected (+ owes you / −
    credit). Media held budget is tracked but excluded from the balance. */
export function clientAccounts(books: AcctBooks): Record<string, AcctClientAccount> {
  const map: Record<string, AcctClientAccount> = {};
  const get = (name: string): AcctClientAccount =>
    (map[name] ??= { client: name, invoiced: 0, collected: 0, held: 0, balance: 0, lines: [] });

  for (const i of books.income) {
    const name = i.client.trim();
    if (!name) continue;
    const acc = get(name);
    acc.invoiced += i.amount;
    acc.lines.push({
      date: i.month,
      kind: "invoice",
      debit: i.amount,
      credit: 0,
      desc: i.type,
      note: i.note,
    });
    if (i.collected) {
      acc.collected += i.amount;
      acc.lines.push({
        date: i.collectedDate || i.month,
        kind: "payment",
        debit: 0,
        credit: i.amount,
        desc: "payment",
        note: i.note,
      });
    }
  }

  for (const mrow of books.mediaLedger) {
    const name = mrow.client.trim();
    if (!name) continue;
    const acc = get(name);
    if (mrow.type === "received") {
      const held = mrow.amount - (mrow.feeAmount ?? 0);
      acc.held += held;
      acc.lines.push({
        date: mrow.date || mrow.month,
        kind: "ad_in",
        debit: 0,
        credit: 0,
        held,
        desc: "ad_in",
        note: mrow.ref,
      });
    } else {
      acc.held -= mrow.amount;
      acc.lines.push({
        date: mrow.date || mrow.month,
        kind: "ad_out",
        debit: 0,
        credit: 0,
        held: -mrow.amount,
        desc: "ad_out",
        note: mrow.ref,
      });
    }
  }

  for (const acc of Object.values(map)) {
    acc.balance = acc.invoiced - acc.collected;
    acc.lines.sort((a, b) => a.date.localeCompare(b.date));
    let run = 0;
    for (const l of acc.lines) {
      run += l.debit - l.credit;
      l.running = run;
    }
  }
  return map;
}

export function clientTotals(books: AcctBooks): {
  owed: number;
  credit: number;
  net: number;
  count: number;
} {
  const accts = Object.values(clientAccounts(books));
  const owed = accts.filter((a) => a.balance > 0).reduce((s, a) => s + a.balance, 0);
  const credit = accts
    .filter((a) => a.balance < 0)
    .reduce((s, a) => s + Math.abs(a.balance), 0);
  return { owed, credit, net: owed - credit, count: accts.length };
}

/* -------------------------------------------------------------- monthly P&L */

export interface AcctPnl {
  incomeByType: Record<string, number>;
  expenseByType: Record<string, number>;
  totalIncome: number;
  totalExpenses: number;
  net: number;
  /** percentage (0–100, float) — display-only, never persisted */
  marginPct: number;
}

export function pnl(books: AcctBooks, m: string): AcctPnl {
  const incomeByType: Record<string, number> = {};
  let totalIncome = 0;
  for (const i of books.income) {
    if (!i.collected || incomeMonth(i) !== m) continue;
    incomeByType[i.type] = (incomeByType[i.type] ?? 0) + i.amount;
    totalIncome += i.amount;
  }
  const expenseByType: Record<string, number> = {};
  let totalExpenses = 0;
  for (const e of monthExpenses(books, m)) {
    if (!isPaid(e)) continue;
    const amt = expenseAmount(e);
    expenseByType[e.type] = (expenseByType[e.type] ?? 0) + amt;
    totalExpenses += amt;
  }
  const net = totalIncome - totalExpenses;
  return {
    incomeByType,
    expenseByType,
    totalIncome,
    totalExpenses,
    net,
    marginPct: totalIncome > 0 ? (net / totalIncome) * 100 : 0,
  };
}

export interface AcctTrendPoint {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

/** the P&L page's 6-month trend ending at `m` */
export function trend(books: AcctBooks, m: string, months = 6): AcctTrendPoint[] {
  const out: AcctTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const mm = addMonths(m, -i);
    out.push({
      month: mm,
      income: incomeIn(books, mm),
      expenses: expenseIn(books, mm),
      net: netIn(books, mm),
    });
  }
  return out;
}

/* ------------------------------------------------------------- departments */

export interface AcctDeptRow {
  id: string;
  income: number;
  cost: number;
  profit: number;
  marginPct: number;
}

export interface AcctDeptReport {
  rows: AcctDeptRow[]; // only departments with activity, media_fee appended
  overhead: number; // paid expenses with no serviceLine
  totalIncome: number;
  totalCost: number;
  directProfit: number;
  netAfterOverhead: number;
}

/** Income earned vs cost incurred per department (paid expenses only, derived
    payroll included). scope: one month or all time. media_fee appears as a
    pure-income row when it earned anything (matching the SPA). */
export function departments(
  books: AcctBooks,
  m: string,
  scope: "month" | "all",
  currentMonth: string,
  deptIds: readonly string[],
): AcctDeptReport {
  const inScope = (mm: string): boolean => (scope === "all" ? true : mm === m);
  const scopedExp = expenseRowsWhere(books, currentMonth, inScope).filter(isPaid);
  const rows: AcctDeptRow[] = [];
  for (const id of deptIds) {
    if (id === "media_fee") continue;
    const income = books.income
      .filter((i) => i.collected && inScope(incomeMonth(i)) && (i.serviceLine || "other") === id)
      .reduce((s, i) => s + i.amount, 0);
    const cost = scopedExp
      .filter((e) => e.serviceLine === id)
      .reduce((s, e) => s + expenseAmount(e), 0);
    rows.push({
      id,
      income,
      cost,
      profit: income - cost,
      marginPct: income > 0 ? ((income - cost) / income) * 100 : 0,
    });
  }
  const mediaFee = books.income
    .filter((i) => i.collected && inScope(incomeMonth(i)) && i.serviceLine === "media_fee")
    .reduce((s, i) => s + i.amount, 0);
  if (mediaFee > 0)
    rows.push({ id: "media_fee", income: mediaFee, cost: 0, profit: mediaFee, marginPct: 100 });
  const active = rows.filter((r) => r.income > 0 || r.cost > 0);
  const overhead = scopedExp
    .filter((e) => !e.serviceLine)
    .reduce((s, e) => s + expenseAmount(e), 0);
  const totalIncome = active.reduce((s, r) => s + r.income, 0);
  const totalCost = active.reduce((s, r) => s + r.cost, 0);
  const directProfit = totalIncome - totalCost;
  return {
    rows: active,
    overhead,
    totalIncome,
    totalCost,
    directProfit,
    netAfterOverhead: directProfit - overhead,
  };
}

/* ---------------------------------------------------------------- dashboard */

export interface AcctDashboard {
  incomeCollected: number; // selected month
  expensesPaid: number; // selected month
  onHold: number; // selected month, awaiting approval
  monthNet: number;
  treasuryNow: number; // cumulative, independent of the viewed month
  accountsReceivable: number; // all months
  accountsPayable: number; // all months
  committedSalary: number; // active roster at currentMonth
  activeStaff: number;
  loansOwe: number;
  loansOwed: number;
  clientsOwe: number;
  target: { goal: number; collected: number } | null;
}

/** every dashboard figure in one pass — also the importer's reconciliation
    numbers (INTEGRATION-PLAN Phase 1 definition of done). */
export function dashboard(books: AcctBooks, m: string, currentMonth: string): AcctDashboard {
  const inc = incomeIn(books, m);
  const activeNow = books.roster.filter((r) => memberAt(r, currentMonth).active);
  const { owe, owed } = loanTotals(books);
  const target = books.targets.find((t) => t.period === m);
  return {
    incomeCollected: inc,
    expensesPaid: expenseIn(books, m),
    onHold: pendingExpenseIn(books, m),
    monthNet: netIn(books, m),
    treasuryNow: liveTreasury(books, currentMonth),
    accountsReceivable: arTotal(books),
    accountsPayable: apTotal(books, currentMonth),
    committedSalary: activeNow.reduce((s, r) => s + memberAt(r, currentMonth).salary, 0),
    activeStaff: activeNow.length,
    loansOwe: owe,
    loansOwed: owed,
    clientsOwe: clientTotals(books).owed,
    target: target ? { goal: target.goal, collected: inc } : null,
  };
}
