import { describe, expect, it } from "vitest";
import {
  addMonths,
  apTotal,
  arTotal,
  autoPayroll,
  clientAccounts,
  clientTotals,
  dashboard,
  departments,
  expenseAmount,
  expenseIn,
  incomeIn,
  incomeMonth,
  liveMonth,
  liveTreasury,
  loanOutstanding,
  loanSettled,
  loanTotals,
  memberAt,
  memberUpsert,
  monthExpenses,
  netIn,
  pendingExpenseIn,
  pnl,
  treasuryThrough,
  trend,
  type AcctBooks,
  type AcctExpenseRow,
  type AcctIncomeRow,
  type AcctLoanRow,
  type AcctMember,
} from "./engine";
import { ACCT_DEPTS } from "./constants";

/* ADR-052 — these tests ENCODE the SPA's business rules at piaster scale.
   Every figure is exact-integer asserted; "NOW" (the SPA's thisMonth()) is
   always an explicit parameter, pinned to 2026-08 here. */

const NOW = "2026-08";

const books = (over: Partial<AcctBooks> = {}): AcctBooks => ({
  openingBalance: 0,
  roster: [],
  expenses: [],
  income: [],
  treasury: [],
  loans: [],
  mediaLedger: [],
  targets: [],
  payrollPaid: {},
  ...over,
});

const income = (over: Partial<AcctIncomeRow>): AcctIncomeRow => ({
  id: "i1",
  month: "2026-05",
  type: "invoice",
  client: "",
  serviceLine: "social",
  amount: 0,
  note: "",
  collected: false,
  collectedDate: null,
  paidMonth: null,
  ...over,
});

const expense = (over: Partial<AcctExpenseRow>): AcctExpenseRow => ({
  id: "e1",
  month: "2026-05",
  type: "subscription",
  name: "",
  serviceLine: "",
  amount: 0,
  deduction: null,
  bonus: null,
  note: "",
  paid: false,
  paidDate: null,
  rosterId: null,
  ...over,
});

const member = (over: Partial<AcctMember>): AcctMember => ({
  id: "r1",
  name: "Nour",
  role: "Designer",
  serviceLine: "branding",
  account: "",
  since: "2026-01",
  segments: [{ from: "2026-01", salary: 500_000, active: true }], // 5,000 EGP
  ...over,
});

describe("month helpers", () => {
  it("addMonths crosses year boundaries both ways", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-08", -14)).toBe("2025-06");
  });
});

describe("cash basis — income counts when collected, not invoiced", () => {
  const late = income({
    id: "late",
    month: "2026-01", // issued January
    amount: 1_000_00,
    collected: true,
    collectedDate: "2026-03-15",
    paidMonth: "2026-03", // cash landed March
  });

  it("a late payment lands in the month it was paid", () => {
    const b = books({ income: [late] });
    expect(incomeIn(b, "2026-01")).toBe(0);
    expect(incomeIn(b, "2026-03")).toBe(1_000_00);
  });

  it("incomeMonth precedence: paidMonth, then collectedDate's month, then issue month", () => {
    expect(incomeMonth(late)).toBe("2026-03");
    expect(
      incomeMonth(income({ collected: true, collectedDate: "2026-04-02", month: "2026-01" })),
    ).toBe("2026-04");
    expect(incomeMonth(income({ month: "2026-01" }))).toBe("2026-01");
  });

  it("uncollected income counts nowhere except accounts receivable", () => {
    const b = books({
      income: [
        income({ id: "a", amount: 700_00, month: "2026-05" }),
        income({ id: "b", amount: 300_00, month: "2026-02" }),
        late,
      ],
    });
    expect(incomeIn(b, "2026-05")).toBe(0);
    expect(arTotal(b)).toBe(1_000_00); // both pending items, never the collected one
  });
});

describe("approval gates cash — on-hold expenses never touch profit or treasury", () => {
  const onHold = expense({ id: "hold", month: "2026-05", amount: 400_00 });
  const paid = expense({ id: "ok", month: "2026-05", amount: 250_00, paid: true, paidDate: "2026-05-10" });
  const b = books({
    income: [income({ amount: 1_000_00, month: "2026-05", collected: true, collectedDate: "2026-05-01", paidMonth: "2026-05" })],
    expenses: [onHold, paid],
  });

  it("only the paid expense hits the month's spend and net", () => {
    expect(expenseIn(b, "2026-05")).toBe(250_00);
    expect(pendingExpenseIn(b, "2026-05")).toBe(400_00);
    expect(netIn(b, "2026-05")).toBe(1_000_00 - 250_00);
  });

  it("the on-hold row is accounts payable across all months", () => {
    const withOld = books({
      ...b,
      expenses: [...b.expenses, expense({ id: "old", month: "2026-01", amount: 99_00 })],
    });
    expect(apTotal(withOld, NOW)).toBe(400_00 + 99_00);
  });

  it("treasury ignores the on-hold amount entirely", () => {
    expect(treasuryThrough(b, "2026-05")).toBe(1_000_00 - 250_00);
  });

  it("payroll net = base − deduction + bonus; other types ignore those fields", () => {
    expect(
      expenseAmount(expense({ type: "payroll", amount: 500_000, deduction: 50_000, bonus: 20_000 })),
    ).toBe(470_000);
    expect(
      expenseAmount(expense({ type: "rent", amount: 100_00, deduction: 50_00, bonus: 20_00 })),
    ).toBe(100_00);
  });
});

describe("auto-payroll — derived from roster segments, never stored", () => {
  it("an active member posts an on-hold salary row every month from their start", () => {
    const b = books({ roster: [member({})] });
    expect(autoPayroll(b, "2025-12")).toEqual([]); // before the first segment
    const row = autoPayroll(b, "2026-03")[0]!;
    expect(row).toMatchObject({
      id: "pay:2026-03:r1",
      auto: true,
      rosterId: "r1",
      type: "payroll",
      amount: 500_000,
      paid: false,
      serviceLine: "branding",
    });
  });

  it("the payrollPaid mark approves exactly that person-month", () => {
    const b = books({ roster: [member({})], payrollPaid: { "2026-03:r1": "2026-03-28" } });
    expect(autoPayroll(b, "2026-03")[0]).toMatchObject({ paid: true, paidDate: "2026-03-28" });
    expect(autoPayroll(b, "2026-04")[0]).toMatchObject({ paid: false, paidDate: null });
  });

  it("an effective-dated raise applies from its month on; earlier months keep the old salary", () => {
    const r = member({
      segments: [
        { from: "2026-01", salary: 500_000, active: true },
        { from: "2026-06", salary: 700_000, active: true },
      ],
    });
    expect(memberAt(r, "2026-05").salary).toBe(500_000);
    expect(memberAt(r, "2026-06").salary).toBe(700_000);
    const b = books({ roster: [r] });
    expect(autoPayroll(b, "2026-05")[0]!.amount).toBe(500_000);
    expect(autoPayroll(b, "2026-07")[0]!.amount).toBe(700_000);
  });

  it("deactivation from a month stops the salary there without rewriting history", () => {
    const r = member({
      segments: [
        { from: "2026-01", salary: 500_000, active: true },
        { from: "2026-04", salary: 500_000, active: false },
      ],
    });
    const b = books({ roster: [r] });
    expect(autoPayroll(b, "2026-03")).toHaveLength(1);
    expect(autoPayroll(b, "2026-04")).toEqual([]);
  });

  it("a LINKED manual payroll row replaces that person's auto row for its month only", () => {
    const b = books({
      roster: [member({})],
      expenses: [
        expense({ id: "m1", month: "2026-03", type: "payroll", rosterId: "r1", amount: 450_000, paid: true }),
      ],
    });
    expect(autoPayroll(b, "2026-03")).toEqual([]); // replaced
    expect(autoPayroll(b, "2026-04")).toHaveLength(1); // untouched
    const rows = monthExpenses(b, "2026-03");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe("m1");
  });

  it("an UNLINKED manual payroll row adds on top — the standing roster payroll stays", () => {
    const b = books({
      roster: [member({})],
      expenses: [
        expense({ id: "bonus", month: "2026-03", type: "payroll", amount: 100_000, paid: true }),
      ],
    });
    const rows = monthExpenses(b, "2026-03");
    expect(rows).toHaveLength(2);
    expect(autoPayroll(b, "2026-03")).toHaveLength(1);
  });

  /* ADR-058 — the founder's one-month payroll adjustment. The row-level
     arithmetic was already proven above; these prove the adjustment reaches
     EVERY total (requirement 7), so a deduction genuinely reduces cost and a
     bonus genuinely raises it, on every surface that spends the books. */
  describe("a one-month adjustment moves every total, not just the row", () => {
    const M = "2026-03";
    const adjusted = (over: Partial<AcctExpenseRow>) =>
      books({
        roster: [member({})], // Nour, branding, 5,000 EGP from 2026-01
        income: [
          income({
            id: "in",
            month: M,
            amount: 1_000_000,
            collected: true,
            collectedDate: `${M}-05`,
            paidMonth: M,
          }),
        ],
        expenses: [
          expense({
            id: "adj",
            month: M,
            type: "payroll",
            name: "Nour",
            serviceLine: "branding",
            rosterId: "r1",
            amount: 500_000,
            paid: true,
            paidDate: `${M}-28`,
            ...over,
          }),
        ],
      });

    it("a deduction lowers the paid spend, the P&L, the department cost and the treasury", () => {
      const b = adjusted({ deduction: 20_000, bonus: 5_000 });
      const net = 500_000 - 20_000 + 5_000; // 485,000
      /* the person is counted ONCE: the derived row is replaced, not added to */
      const payroll = monthExpenses(b, M).filter((e) => e.type === "payroll");
      expect(payroll).toHaveLength(1);
      expect(expenseAmount(payroll[0]!)).toBe(net);

      expect(expenseIn(b, M)).toBe(net);
      expect(pnl(b, M).expenseByType["payroll"]).toBe(net);
      expect(pnl(b, M).totalExpenses).toBe(net);
      expect(netIn(b, M)).toBe(1_000_000 - net);
      expect(treasuryThrough(b, M)).toBe(1_000_000 - net);

      const dept = departments(b, M, "month", NOW, ACCT_DEPTS).rows.find((r) => r.id === "branding");
      expect(dept!.cost).toBe(net); // NOT parked in overhead
      expect(departments(b, M, "month", NOW, ACCT_DEPTS).overhead).toBe(0);
      expect(dashboard(b, M, NOW).expensesPaid).toBe(net);
    });

    it("a bonus RAISES the cost — the sign is right in the payable direction too", () => {
      const b = adjusted({ bonus: 30_000, paid: false, paidDate: null });
      expect(expenseAmount(monthExpenses(b, M).find((e) => e.id === "adj")!)).toBe(530_000);
      expect(pendingExpenseIn(b, M)).toBe(530_000);
      expect(expenseIn(b, M)).toBe(0); // still on hold: nothing touched cash
      /* accounts payable spans every month, so compare against the same books
         with no bonus: the payable owed must rise by exactly the bonus */
      const plain = adjusted({ paid: false, paidDate: null });
      expect(apTotal(b, NOW) - apTotal(plain, NOW)).toBe(30_000);
    });

    it("the adjustment NEVER touches the roster, and never any other month", () => {
      const b = adjusted({ deduction: 20_000 });
      const r = b.roster[0]!;
      /* the founder's complaint answered in the opposite direction: editing one
         month of pay must NOT rewrite the salary from that month forward */
      expect(memberAt(r, M).salary).toBe(500_000);
      expect(memberAt(r, "2026-04").salary).toBe(500_000);
      expect(dashboard(b, M, NOW).committedSalary).toBe(500_000);
      expect(autoPayroll(b, "2026-04")).toHaveLength(1);
      expect(autoPayroll(b, "2026-04")[0]!.amount).toBe(500_000);
      expect(autoPayroll(b, "2026-02")[0]!.amount).toBe(500_000);
    });

    it("deleting the adjustment brings the derived roster row back for that month", () => {
      const b = adjusted({ deduction: 20_000 });
      expect(autoPayroll(b, M)).toEqual([]); // covered while it exists
      const after = books({ ...b, expenses: [] }); // the row deleted
      const rows = monthExpenses(after, M);
      expect(rows).toHaveLength(1);
      expect(rows[0]!.id).toBe("pay:2026-03:r1");
      expect(rows[0]!).toMatchObject({ auto: true, amount: 500_000, deduction: null, bonus: null });
      expect(expenseAmount(rows[0]!)).toBe(500_000); // the deduction went with it
    });

    it("an unguarded deduction over the base would make the row NEGATIVE — the schema refuses it", () => {
      /* documents the engine's raw behaviour, which is why the guard lives in
         expenseSchema: a negative net turns an expense into income */
      expect(
        expenseAmount(expense({ type: "payroll", amount: 100_000, deduction: 150_000 })),
      ).toBe(-50_000);
    });
  });

  it("memberUpsert changes one month forward, replaces a same-month segment, keeps partial fields", () => {
    const r = member({});
    const segs = memberUpsert(r, "2026-04", { salary: 600_000 });
    expect(segs).toEqual([
      { from: "2026-01", salary: 500_000, active: true },
      { from: "2026-04", salary: 600_000, active: true }, // active carried over
    ]);
    const replaced = memberUpsert({ ...r, segments: segs }, "2026-04", { active: false });
    expect(replaced).toEqual([
      { from: "2026-01", salary: 500_000, active: true },
      { from: "2026-04", salary: 600_000, active: false }, // same month replaced, salary kept
    ]);
  });
});

describe("media pass-through — client budget never touches profit", () => {
  /* the SPA's `received` action writes three rows: fee income (collected),
     a treasury deposit of the held remainder, and the ledger entry; `sent`
     writes a withdrawal + ledger entry. The engine must see ONLY the fee in
     profit while the budget washes through treasury. */
  const m = "2026-05";
  const b = books({
    income: [
      income({
        id: "fee",
        month: m,
        type: "media_fee",
        client: "Acme",
        serviceLine: "media_fee",
        amount: 1_500_00,
        collected: true,
        collectedDate: "2026-05-03",
        paidMonth: m,
      }),
    ],
    treasury: [
      { id: "t1", month: m, kind: "deposit", label: "Client ad budget held — Acme", amount: 8_500_00, date: "2026-05-03", tag: "media" },
      { id: "t2", month: m, kind: "withdraw", label: "Ad spend to buyer — Acme", amount: 8_500_00, date: "2026-05-20", tag: "media" },
    ],
    mediaLedger: [
      { id: "md1", month: m, client: "Acme", type: "received", amount: 10_000_00, feeAmount: 1_500_00, date: "2026-05-03", ref: "" },
      { id: "md2", month: m, client: "Acme", type: "sent", amount: 8_500_00, feeAmount: null, date: "2026-05-20", ref: "" },
    ],
  });

  it("profit sees only the agency fee", () => {
    expect(netIn(b, m)).toBe(1_500_00);
  });

  it("treasury washes: held in, spent out — only the fee remains", () => {
    expect(treasuryThrough(b, m)).toBe(1_500_00);
  });

  it("the client account tracks held budget apart from the owed balance", () => {
    const acc = clientAccounts(b)["Acme"]!;
    expect(acc.invoiced).toBe(1_500_00); // the fee income is a real invoice
    expect(acc.collected).toBe(1_500_00);
    expect(acc.balance).toBe(0);
    expect(acc.held).toBe(0); // 8,500 held, then 8,500 forwarded
  });

  it("budget still held shows on the client until it is sent", () => {
    const heldOnly = books({
      mediaLedger: [
        { id: "md1", month: m, client: "Acme", type: "received", amount: 10_000_00, feeAmount: 1_500_00, date: "2026-05-03", ref: "" },
      ],
    });
    expect(clientAccounts(heldOnly)["Acme"]!.held).toBe(8_500_00);
  });
});

describe("loans — cash moves, profit never; 50-piaster settlement epsilon", () => {
  const loan = (over: Partial<AcctLoanRow>): AcctLoanRow => ({
    id: "l1",
    direction: "borrowed",
    party: "Bank",
    principal: 10_000_00,
    date: "2026-02-01",
    dueDate: "",
    note: "",
    payments: [],
    ...over,
  });

  it("outstanding = principal − Σ payments, floored at zero", () => {
    const l = loan({ payments: [{ id: "p1", amount: 4_000_00, date: "2026-03-01", note: "" }] });
    expect(loanOutstanding(l)).toBe(6_000_00);
    expect(loanOutstanding(loan({ payments: [{ id: "p", amount: 11_000_00, date: "", note: "" }] }))).toBe(0);
  });

  it("settled within 50 piasters — 50 settles, 51 stays open", () => {
    const almost = loan({ payments: [{ id: "p", amount: 9_999_50, date: "", note: "" }] });
    expect(loanOutstanding(almost)).toBe(50);
    expect(loanSettled(almost)).toBe(true);
    const notQuite = loan({ payments: [{ id: "p", amount: 9_999_49, date: "", note: "" }] });
    expect(loanOutstanding(notQuite)).toBe(51);
    expect(loanSettled(notQuite)).toBe(false);
  });

  it("loanTotals splits by direction and nets receivable − payable", () => {
    const b = books({
      loans: [
        loan({}),
        loan({ id: "l2", direction: "lent", party: "Staff", principal: 3_000_00 }),
      ],
    });
    expect(loanTotals(b)).toEqual({ owe: 10_000_00, owed: 3_000_00, net: -7_000_00 });
  });

  it("a loan is not income: only its treasury deposit moves cash", () => {
    const b = books({
      loans: [loan({})],
      treasury: [
        { id: "t", month: "2026-02", kind: "deposit", label: "Loan received — Bank", amount: 10_000_00, date: "2026-02-01", tag: "loan" },
      ],
    });
    expect(incomeIn(b, "2026-02")).toBe(0);
    expect(netIn(b, "2026-02")).toBe(0);
    expect(treasuryThrough(b, "2026-02")).toBe(10_000_00);
  });
});

describe("treasury — running balance from opening + monthly nets + moves", () => {
  const b = books({
    openingBalance: 1_000_00,
    income: [
      income({ id: "a", month: "2026-01", amount: 500_00, collected: true, collectedDate: "2026-01-05", paidMonth: "2026-01" }),
    ],
    expenses: [expense({ id: "e", month: "2026-02", amount: 200_00, paid: true, paidDate: "2026-02-10" })],
    treasury: [
      { id: "t1", month: "2026-01", kind: "deposit", label: "", amount: 300_00, date: "2026-01-02", tag: "" },
      { id: "t2", month: "2026-02", kind: "withdraw", label: "", amount: 100_00, date: "2026-02-15", tag: "" },
    ],
  });

  it("accumulates month by month", () => {
    expect(treasuryThrough(b, "2026-01")).toBe(1_000_00 + 500_00 + 300_00);
    expect(treasuryThrough(b, "2026-02")).toBe(1_000_00 + 500_00 + 300_00 - 200_00 - 100_00);
  });

  it("liveTreasury is the balance at the newest active month, whatever is viewed", () => {
    expect(liveMonth(b, NOW)).toBe(NOW); // no activity beyond August
    expect(liveTreasury(b, NOW)).toBe(1_500_00);
    const future = books({
      ...b,
      treasury: [
        ...b.treasury,
        { id: "t3", month: "2026-10", kind: "deposit", label: "", amount: 50_00, date: "2026-10-01", tag: "" },
      ],
    });
    expect(liveMonth(future, NOW)).toBe("2026-10"); // future activity wins
    expect(liveTreasury(future, NOW)).toBe(1_550_00);
  });

  it("derived payroll drains treasury only once approved", () => {
    const withStaff = books({ roster: [member({ segments: [{ from: "2026-05", salary: 500_000, active: true }] })] });
    expect(treasuryThrough(withStaff, NOW)).toBe(0); // on hold — not cash yet
    const approved = books({
      ...withStaff,
      payrollPaid: { "2026-05:r1": "2026-05-30" },
    });
    expect(treasuryThrough(approved, NOW)).toBe(-500_000);
  });
});

describe("client accounts — the derived A/R sub-ledger", () => {
  const b = books({
    income: [
      income({ id: "i1", month: "2026-01", client: "Acme", amount: 2_000_00, collected: true, collectedDate: "2026-02-04", paidMonth: "2026-02" }),
      income({ id: "i2", month: "2026-03", client: "Acme", amount: 1_500_00 }),
      income({ id: "i3", month: "2026-03", client: " Beta ", amount: 700_00 }), // name trims
      income({ id: "i4", month: "2026-03", client: "", amount: 999_00 }), // no client — no ledger
    ],
  });

  it("invoiced − collected = balance; positive means they owe you", () => {
    const acme = clientAccounts(b)["Acme"]!;
    expect(acme.invoiced).toBe(3_500_00);
    expect(acme.collected).toBe(2_000_00);
    expect(acme.balance).toBe(1_500_00);
    expect(clientAccounts(b)["Beta"]!.invoiced).toBe(700_00);
  });

  it("statement lines are chronological with a running debit−credit balance", () => {
    const acme = clientAccounts(b)["Acme"]!;
    expect(acme.lines.map((l) => [l.kind, l.running])).toEqual([
      ["invoice", 2_000_00], // 2026-01 invoice
      ["payment", 0], // 2026-02-04 payment
      ["invoice", 1_500_00], // 2026-03 invoice
    ]);
  });

  it("clientTotals sums owed and credit separately", () => {
    /* NOTE: with income items alone, collected ≤ invoiced per client (every
       collection credits exactly its own invoice), so `credit` can only be 0 —
       mirrored from the SPA, whose UI nonetheless displays the branch. */
    const oneOwing = books({ income: [income({ id: "i1", client: "Acme", amount: 1_000_00 })] });
    expect(clientTotals(oneOwing)).toEqual({ owed: 1_000_00, credit: 0, net: 1_000_00, count: 1 });
    expect(clientTotals(b).owed).toBe(1_500_00 + 700_00);
  });
});

describe("monthly P&L", () => {
  const m = "2026-05";
  const b = books({
    roster: [member({ segments: [{ from: m, salary: 500_000, active: true }] })],
    payrollPaid: { [`${m}:r1`]: "2026-05-28" },
    income: [
      income({ id: "i1", month: m, type: "invoice", amount: 3_000_00, collected: true, collectedDate: "2026-05-02", paidMonth: m }),
      income({ id: "i2", month: m, type: "consulting", amount: 1_000_00, collected: true, collectedDate: "2026-05-09", paidMonth: m }),
      income({ id: "i3", month: m, type: "invoice", amount: 9_999_00 }), // pending — excluded
    ],
    expenses: [
      expense({ id: "e1", month: m, type: "rent", amount: 800_00, paid: true }),
      expense({ id: "e2", month: m, type: "rent", amount: 999_00 }), // on hold — excluded
    ],
  });

  it("groups by type, includes derived approved payroll, excludes on-hold and pending", () => {
    const p = pnl(b, m);
    expect(p.incomeByType).toEqual({ invoice: 3_000_00, consulting: 1_000_00 });
    expect(p.expenseByType).toEqual({ rent: 800_00, payroll: 500_000 });
    expect(p.totalIncome).toBe(4_000_00);
    expect(p.totalExpenses).toBe(800_00 + 500_000);
    expect(p.net).toBe(4_000_00 - 800_00 - 500_000);
    expect(p.marginPct).toBeCloseTo((p.net / p.totalIncome) * 100, 6);
  });

  it("trend returns the six months ending at the viewed one", () => {
    const t = trend(b, m);
    expect(t).toHaveLength(6);
    expect(t[0]!.month).toBe("2025-12");
    expect(t[5]).toEqual({ month: m, income: 4_000_00, expenses: 800_00 + 500_000, net: 4_000_00 - 800_00 - 500_000 });
  });
});

describe("departments — profitability per service line", () => {
  const m = "2026-05";
  const b = books({
    roster: [member({ serviceLine: "branding", segments: [{ from: m, salary: 500_000, active: true }] })],
    payrollPaid: { [`${m}:r1`]: "2026-05-28" }, // branding cost via derived payroll
    income: [
      income({ id: "i1", month: m, serviceLine: "branding", amount: 9_000_00, collected: true, collectedDate: "2026-05-02", paidMonth: m }),
      income({ id: "i2", month: m, serviceLine: "media_fee", type: "media_fee", amount: 1_200_00, collected: true, collectedDate: "2026-05-03", paidMonth: m }),
      income({ id: "i3", month: "2026-04", serviceLine: "web", amount: 2_000_00, collected: true, collectedDate: "2026-04-20", paidMonth: "2026-04" }),
    ],
    expenses: [
      expense({ id: "e1", month: m, serviceLine: "", amount: 300_00, paid: true }), // overhead
      expense({ id: "e2", month: m, serviceLine: "web", amount: 150_00, paid: true }),
    ],
  });

  it("month scope: tagged income vs tagged cost, media fee as a pure-income row, overhead apart", () => {
    const rep = departments(b, m, "month", NOW, ACCT_DEPTS);
    const branding = rep.rows.find((r) => r.id === "branding")!;
    expect(branding).toEqual({ id: "branding", income: 9_000_00, cost: 500_000, profit: 9_000_00 - 500_000, marginPct: ((9_000_00 - 500_000) / 9_000_00) * 100 });
    expect(rep.rows.find((r) => r.id === "media_fee")).toEqual({ id: "media_fee", income: 1_200_00, cost: 0, profit: 1_200_00, marginPct: 100 });
    const web = rep.rows.find((r) => r.id === "web")!;
    expect(web.income).toBe(0); // April income is out of scope
    expect(web.cost).toBe(150_00);
    expect(rep.overhead).toBe(300_00);
    expect(rep.directProfit).toBe(rep.totalIncome - rep.totalCost);
    expect(rep.netAfterOverhead).toBe(rep.directProfit - 300_00);
  });

  it("all-time scope folds every month in", () => {
    const rep = departments(b, m, "all", NOW, ACCT_DEPTS);
    expect(rep.rows.find((r) => r.id === "web")!.income).toBe(2_000_00);
  });
});

describe("dashboard — the reconciliation numbers", () => {
  it("committed salary follows the roster's CURRENT effective values", () => {
    const b = books({
      roster: [
        member({}), // 5,000 EGP active
        member({
          id: "r2",
          name: "Off",
          segments: [
            { from: "2026-01", salary: 400_000, active: true },
            { from: "2026-07", salary: 400_000, active: false }, // left in July
          ],
        }),
      ],
      targets: [{ period: NOW, goal: 10_000_00 }],
    });
    const d = dashboard(b, NOW, NOW);
    expect(d.committedSalary).toBe(500_000);
    expect(d.activeStaff).toBe(1);
    expect(d.target).toEqual({ goal: 10_000_00, collected: 0 });
    /* unapproved derived payroll is accounts payable: r1 Jan–Aug (8 months of
       5,000) + r2 Jan–Jun (6 months of 4,000 — inactive from July) */
    expect(d.accountsPayable).toBe(8 * 500_000 + 6 * 400_000);
  });
});

/* ============================================================================
   ADR-060 — the founder's two vocabulary additions, pinned at the engine.

   "media_campaign" (Media Buying / Campaigns) is OUR OWN campaign spend: an
   ORDINARY cost that counts against profit — deliberately unlike the media
   LEDGER's pass-through client budget. "bsystems" is a real department line.
   NO engine code changed for either; these tests exist so a later refactor
   can never quietly add a type branch. */

describe("ADR-060 — Media Buying / Campaigns is an ordinary cost", () => {
  const m = "2026-05";
  const base = books({
    income: [income({ amount: 1_000_00, month: m, collected: true, collectedDate: "2026-05-01", paidMonth: m })],
  });
  const withCampaign = books({
    ...base,
    expenses: [expense({ id: "camp", month: m, type: "media_campaign", amount: 2_000_00, paid: true, paidDate: "2026-05-10" })],
  });

  it("counts against profit exactly like rent — full amount, no pass-through", () => {
    expect(expenseAmount(expense({ type: "media_campaign", amount: 2_000_00 }))).toBe(2_000_00);
    expect(pnl(withCampaign, m).expenseByType["media_campaign"]).toBe(2_000_00);
    expect(pnl(withCampaign, m).totalExpenses).toBe(pnl(base, m).totalExpenses + 2_000_00);
    expect(pnl(withCampaign, m).net).toBe(pnl(base, m).net - 2_000_00);
    expect(expenseIn(withCampaign, m)).toBe(expenseIn(base, m) + 2_000_00);
    expect(netIn(withCampaign, m)).toBe(netIn(base, m) - 2_000_00);
    expect(treasuryThrough(withCampaign, m)).toBe(treasuryThrough(base, m) - 2_000_00);
  });

  it("deduction and bonus never ride a media_campaign row — the netting is payroll-only", () => {
    expect(
      expenseAmount(expense({ type: "media_campaign", amount: 2_000_00, deduction: 500_00, bonus: 100_00 })),
    ).toBe(2_000_00);
  });

  it("an UNPAID campaign row is accounts payable, not spend — the approval gate applies", () => {
    const onHold = books({
      ...base,
      expenses: [expense({ id: "campHold", month: m, type: "media_campaign", amount: 2_000_00 })],
    });
    expect(expenseIn(onHold, m)).toBe(expenseIn(base, m));
    expect(pendingExpenseIn(onHold, m)).toBe(2_000_00);
    expect(apTotal(onHold, NOW)).toBe(2_000_00);
    expect(netIn(onHold, m)).toBe(netIn(base, m));
  });
});

describe("ADR-060 — B-Systems is a real department line", () => {
  const m = "2026-05";

  it("tagged cost and income land on the bsystems row, never in overhead", () => {
    const b = books({
      income: [income({ id: "i1", month: m, serviceLine: "bsystems", amount: 4_000_00, collected: true, collectedDate: "2026-05-02", paidMonth: m })],
      expenses: [expense({ id: "e1", month: m, serviceLine: "bsystems", amount: 700_00, paid: true, paidDate: "2026-05-05" })],
    });
    const rep = departments(b, m, "month", NOW, ACCT_DEPTS);
    expect(rep.rows.find((r) => r.id === "bsystems")).toEqual({
      id: "bsystems",
      income: 4_000_00,
      cost: 700_00,
      profit: 4_000_00 - 700_00,
      marginPct: ((4_000_00 - 700_00) / 4_000_00) * 100,
    });
    expect(rep.overhead).toBe(0);
    expect(rep.totalCost).toBe(700_00);
    expect(rep.totalIncome).toBe(4_000_00);
  });

  it("the same cost untagged stays overhead, and no empty bsystems row renders", () => {
    const b = books({
      expenses: [expense({ id: "e1", month: m, serviceLine: "", amount: 700_00, paid: true, paidDate: "2026-05-05" })],
    });
    const rep = departments(b, m, "month", NOW, ACCT_DEPTS);
    expect(rep.rows.find((r) => r.id === "bsystems")).toBeUndefined();
    expect(rep.overhead).toBe(700_00);
  });

  it("a roster member tagged to bsystems moves the whole salary out of overhead", () => {
    const b = books({
      roster: [member({ serviceLine: "bsystems", segments: [{ from: m, salary: 500_000, active: true }] })],
      payrollPaid: { [`${m}:r1`]: "2026-05-28" },
    });
    const rep = departments(b, m, "month", NOW, ACCT_DEPTS);
    expect(rep.rows.find((r) => r.id === "bsystems")!.cost).toBe(500_000);
    expect(rep.overhead).toBe(0);
  });
});
