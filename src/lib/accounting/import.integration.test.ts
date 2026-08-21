import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { importAccounting } from "./import";
import { loadBooks } from "./books";
import { addMonths, dashboard, paidExpenseIn } from "./engine";
import { cairoMonth } from "./now";
import type { Actor } from "@/lib/services/activity";

/* ============================================================================
   ADR-052 Phase 1 definition of done: importing the OLD APP'S OWN JSON EXPORT
   reproduces its dashboard numbers — treasury, month net, A/R, A/P, committed
   salary — to the piaster, with payroll DERIVED (never materialised as rows).

   The fixture is built RELATIVE to the current Cairo month (M0 = now, M1 =
   last month, …) because committed salary and the payroll derivation are
   defined against "today". Amounts are EGP exactly as the SPA exports them
   (integers, and one deliberate 1999.5 to prove the ×100 stays lossless).

   It exercises every entity and the named edges: an on-hold expense, an
   effective-dated raise, a member leaving this month, a LINKED manual payroll
   row replacing an auto salary, a legacy pre-approval expense with no `paid`
   key, a legacy payroll row with deduction/bonus, media pass-through with a
   partially-forwarded budget, a partial loan repayment, a lent loan settled
   within the 50-piaster epsilon, an orphan payrollPaid key, and the
   two-company "Export ALL" wrapper.
   ========================================================================== */

const actor: Actor = { id: null, label: "Import Admin" };

const M0 = cairoMonth();
const M1 = addMonths(M0, -1);
const M2 = addMonths(M0, -2);
const M3 = addMonths(M0, -3);

/** the ByteForce tenant document, exactly as the SPA exports it (EGP) */
const byteforceDoc = {
  openingBalance: 2500,
  roster: [
    {
      id: "aya1",
      name: "Aya",
      role: "Designer",
      serviceLine: "branding",
      account: "100200300",
      since: M3,
      salary: 8000,
      active: true,
      segments: [
        { from: M3, salary: 6000, active: true },
        { from: M1, salary: 8000, active: true }, // raise effective M1
      ],
    },
    {
      id: "karim1",
      name: "Karim",
      role: "Editor",
      serviceLine: "video",
      account: "",
      since: M2,
      salary: 4000,
      active: false,
      segments: [
        { from: M2, salary: 4000, active: true },
        { from: M0, salary: 4000, active: false }, // left this month
      ],
    },
  ],
  expenses: [
    /* legacy row predating the approval feature: NO `paid` key → counts Paid */
    { id: "old1", month: M3, type: "other", name: "Legacy", serviceLine: "", amount: 500, note: "" },
    /* legacy unlinked payroll with deduction/bonus: net = 1000 − 100 + 50 */
    { id: "extra1", month: M2, type: "payroll", name: "Contract QA", serviceLine: "", amount: 1000, deduction: 100, bonus: 50, note: "", paid: true, paidDate: `${M2}-20` },
    /* LINKED manual payroll — replaces Aya's 8000 auto row for M1 */
    { id: "link1", month: M1, type: "payroll", name: "Aya", serviceLine: "branding", amount: 7500, note: "adjusted", paid: true, paidDate: `${M1}-28`, rosterId: "aya1" },
    { id: "rent1", month: M0, type: "rent", name: "Office", serviceLine: "", amount: 2000, note: "", paid: true, paidDate: `${M0}-01` },
    /* the on-hold expense: never cash, always payable */
    { id: "hold1", month: M0, type: "subscription", name: "Figma", serviceLine: "web", amount: 300, note: "", paid: false, paidDate: null },
  ],
  income: [
    { id: "inv1", month: M2, type: "invoice", client: "Acme", serviceLine: "social", amount: 10000, note: "", collected: true, collectedDate: `${M2}-10`, paidMonth: M2 },
    /* issued M2, cash landed M0 — must count in M0 (cash basis) */
    { id: "inv2", month: M2, type: "invoice", client: "Acme", serviceLine: "social", amount: 5000, note: "", collected: true, collectedDate: `${M0}-05`, paidMonth: M0 },
    { id: "inv3", month: M0, type: "invoice", client: "Beta", serviceLine: "web", amount: 3000, note: "", collected: false, collectedDate: null, paidMonth: null },
    /* the media fee income the SPA mints on "funds received" */
    { id: "fee1", month: M1, type: "media_fee", client: "Gamma", serviceLine: "media_fee", amount: 1500, note: "Media fee (budget)", collected: true, collectedDate: `${M1}-03`, paidMonth: M1, mediaRef: "md1" },
  ],
  treasury: [
    { id: "t1", month: M1, kind: "deposit", label: "Client ad budget held — Gamma", amount: 8500, date: `${M1}-03`, tag: "media" },
    { id: "t2", month: M1, kind: "withdraw", label: "Ad spend to buyer — Gamma", amount: 6000, date: `${M1}-15`, tag: "media" },
    { id: "t3", month: M2, kind: "deposit", label: "Loan received — Owner", amount: 20000, date: `${M2}-01`, tag: "loan" },
    { id: "t5", month: M1, kind: "withdraw", label: "Loan repayment — Owner", amount: 5000, date: `${M1}-10`, tag: "loan" },
    { id: "t4", month: M3, kind: "withdraw", label: "Owner draw", amount: 1000, date: `${M3}-20`, tag: "" },
  ],
  loans: [
    /* partial repayment: 20,000 borrowed, 5,000 repaid → 15,000 outstanding */
    { id: "l1", direction: "borrowed", party: "Owner", principal: 20000, date: `${M2}-01`, dueDate: "", note: "", payments: [{ id: "p1", amount: 5000, date: `${M1}-10`, note: "" }] },
    /* lent 2,000, repaid 1,999.5 → 50 piasters outstanding = settled by ε */
    { id: "l2", direction: "lent", party: "Freelancer", principal: 2000, date: `${M2}-05`, dueDate: "", note: "", payments: [{ id: "p2", amount: 1999.5, date: `${M0}-02`, note: "" }] },
  ],
  mediaLedger: [
    { id: "md1", month: M1, client: "Gamma", type: "received", amount: 10000, feeAmount: 1500, date: `${M1}-03`, ref: "TRX-1" },
    { id: "md2", month: M1, client: "Gamma", type: "sent", amount: 6000, date: `${M1}-15`, ref: "Meta" },
  ],
  targets: [{ period: M0, goal: 20000 }],
  payrollPaid: {
    [`${M3}:aya1`]: `${M3}-28`,
    [`${M2}:aya1`]: `${M2}-28`,
    [`${M2}:karim1`]: `${M2}-28`,
    [`${M2}:ghost`]: `${M2}-28`, // orphan (deleted member) — dropped, neutral
  },
  _savedAt: 1765000000000, // stripped noise the real export carries
};

const bsystemsDoc = {
  openingBalance: 0,
  roster: [],
  expenses: [
    { id: "b1", month: M0, type: "admin", name: "Hosting", serviceLine: "", amount: 200, note: "", paid: false, paidDate: null },
  ],
  income: [
    { id: "b2", month: M0, type: "consulting", client: "Delta", serviceLine: "other", amount: 1000, note: "", collected: true, collectedDate: `${M0}-04`, paidMonth: M0 },
  ],
  treasury: [],
  loans: [],
  mediaLedger: [],
  targets: [],
  payrollPaid: {},
};

/* the "Export ALL companies (JSON)" wrapper shape */
const allCompaniesFile = { byteforce: byteforceDoc, bsystems: bsystemsDoc };

beforeEach(async () => {
  await resetDb();
});

describe("accounting import — the old app's export reproduces its dashboard exactly", () => {
  it("imports the two-company wrapper and derives the reconciliation numbers to the piaster", async () => {
    const summary = await importAccounting(allCompaniesFile, null, actor);
    expect(summary.companies.map((c) => c.company)).toEqual(["byteforce", "bsystems"]);

    const bf = summary.companies[0]!;
    expect(bf.counts).toEqual({
      income: 4,
      expenses: 5,
      roster: 2,
      payrollMarks: 3, // the orphan key was dropped
      treasury: 5,
      loans: 2,
      loanPayments: 2,
      mediaEntries: 2,
      targets: 1,
    });

    /* ---- hand-computed expectations, piasters (EGP × 100) ----
       nets: M3 = 0 − (Aya 6000 approved + legacy 500)          = −6,500
             M2 = 10,000 − (Aya 6000 + Karim 4000 + extra 950)  =   −950
             M1 = 1,500 (fee) − (linked 7,500)                  = −6,000
             M0 = 5,000 (late inv2) − (rent 2,000)              = +3,000
       moves: M3 −1,000 · M2 +20,000 · M1 (+8,500 −6,000 −5,000) = −2,500
       treasury now = 2,500 −10,450 +16,500                     =  8,550 */
    expect(bf.verify.month).toBe(M0);
    expect(bf.verify.treasuryNow).toBe(8_550_00);
    expect(bf.verify.monthNet).toBe(3_000_00);
    expect(bf.verify.incomeCollected).toBe(5_000_00);
    expect(bf.verify.expensesPaid).toBe(2_000_00);
    /* on hold this month: Aya's unapproved auto 8,000 + Figma 300 */
    expect(bf.verify.onHold).toBe(8_300_00);
    /* A/P all months adds Karim's unapproved M1 salary 4,000 */
    expect(bf.verify.accountsPayable).toBe(12_300_00);
    expect(bf.verify.accountsReceivable).toBe(3_000_00); // inv3 pending
    /* committed NOW: Aya 8,000 active; Karim inactive from M0 */
    expect(bf.verify.committedSalary).toBe(8_000_00);
    expect(bf.verify.activeStaff).toBe(1);
    expect(bf.verify.loansOwe).toBe(15_000_00);
    expect(bf.verify.loansOwed).toBe(50); // 1,999.5 of 2,000 repaid — ε territory
    expect(bf.verify.clientsOwe).toBe(3_000_00); // Beta; Acme settled; Gamma's held ≠ debt
    expect(bf.verify.target).toEqual({ goal: 20_000_00, collected: 5_000_00 });

    const bs = summary.companies[1]!;
    expect(bs.verify.treasuryNow).toBe(1_000_00);
    expect(bs.verify.monthNet).toBe(1_000_00);
    expect(bs.verify.accountsPayable).toBe(200_00);
    expect(bs.verify.accountsReceivable).toBe(0);
    expect(bs.verify.committedSalary).toBe(0);

    /* the numbers the importer reported ARE the engine's over the stored rows */
    const books = await loadBooks("byteforce");
    const { month: _month, ...verifyNumbers } = bf.verify;
    expect(dashboard(books, M0, M0)).toEqual(verifyNumbers);
  });

  it("NEVER materialises payroll as expense rows — the engine derives them", async () => {
    await importAccounting(allCompaniesFile, null, actor);
    const stored = await db.acctExpense.findMany({ where: { company: "byteforce" } });
    expect(stored).toHaveLength(5); // exactly the manual rows in the file
    /* the only payroll rows stored are the two MANUAL ones from the export */
    expect(stored.filter((e) => e.type === "payroll")).toHaveLength(2);
    /* approval marks became rows; the orphan key resolved to nothing */
    expect(await db.acctPayrollPayment.count()).toBe(3);
  });

  it("remaps old uid links onto new cuids (rosterId, payrollPaid, mediaRef)", async () => {
    await importAccounting(allCompaniesFile, null, actor);
    const aya = await db.acctRosterMember.findFirstOrThrow({ where: { name: "Aya" } });
    const linked = await db.acctExpense.findFirstOrThrow({ where: { note: "adjusted" } });
    expect(linked.rosterId).toBe(aya.id);
    const marks = await db.acctPayrollPayment.findMany({ where: { memberId: aya.id } });
    expect(marks.map((m) => m.month).sort()).toEqual([M3, M2].sort());
    const fee = await db.acctIncome.findFirstOrThrow({ where: { type: "media_fee" } });
    const media = await db.acctMediaEntry.findFirstOrThrow({ where: { type: "received" } });
    expect(fee.mediaEntryId).toBe(media.id);
    /* Aya's raise survived as two effective-dated segments */
    const segs = await db.acctRosterSegment.findMany({ where: { memberId: aya.id }, orderBy: { from: "asc" } });
    expect(segs.map((s) => ({ from: s.from, salary: s.salary, active: s.active }))).toEqual([
      { from: M3, salary: 600_000, active: true },
      { from: M1, salary: 800_000, active: true },
    ]);
  });

  it("re-importing REPLACES the company's books — idempotent to the piaster", async () => {
    await importAccounting(allCompaniesFile, null, actor);
    const again = await importAccounting(allCompaniesFile, null, actor);
    expect(again.companies[0]!.verify.treasuryNow).toBe(8_550_00);
    expect(await db.acctIncome.count({ where: { company: "byteforce" } })).toBe(4);
    expect(await db.acctExpense.count({ where: { company: "byteforce" } })).toBe(5);
    expect(await db.acctLoanPayment.count()).toBe(2);
    expect(await db.acctTarget.count()).toBe(1); // byteforce's one; bsystems has none
  });

  it("a single-company file needs its company named; the other company is untouched", async () => {
    await expect(importAccounting(byteforceDoc, null, actor)).rejects.toMatchObject({ status: 400 });
    const summary = await importAccounting(byteforceDoc, "byteforce", actor);
    expect(summary.companies).toHaveLength(1);
    expect(summary.companies[0]!.verify.treasuryNow).toBe(8_550_00);
    expect(await db.acctIncome.count({ where: { company: "bsystems" } })).toBe(0);
  });

  it("legacy tolerance mirrors migrate(): junk collections, no-paid-key, no-since", async () => {
    const scrappy = {
      income: "not-an-array",
      expenses: [{ id: "x", month: M0, type: "other", amount: 100 }], // no paid key
      roster: [{ id: "r", name: "New", salary: 1000 }], // no since / segments
      openingBalance: "250",
    };
    const summary = await importAccounting(scrappy, "byteforce", actor);
    const v = summary.companies[0]!.verify;
    /* the no-paid-key expense imported as PAID; the sinceless member starts
       this month on hold: net = −100, opening 250 → treasury 150 */
    expect(v.treasuryNow).toBe(150_00);
    expect(v.committedSalary).toBe(1_000_00);
    expect(v.onHold).toBe(1_000_00);
    const seg = await db.acctRosterSegment.findFirstOrThrow();
    expect(seg.from).toBe(M0);
  });

  /* ADR-058 — the import is the ONLY path that has ever populated deduction /
     bonus, so it is the only path a NEGATIVE NET could ever arrive by.
     `expenseAmount()` has no floor: base − deduction + bonus below zero is an
     expense that ADDS money — paid spend down, net profit up, treasury up. The
     typed write path refuses it; a file may not smuggle one past. */
  it("refuses a payroll line whose deduction is bigger than its salary plus bonus", async () => {
    const doc = {
      openingBalance: 0,
      expenses: [
        { id: "e1", month: M0, type: "payroll", name: "Typo", amount: 5000, deduction: 9000, paid: true },
      ],
    };
    await expect(importAccounting(doc, "byteforce", actor)).rejects.toMatchObject({ status: 400 });
    /* refused while PARSING — the REPLACE never ran, so nothing was destroyed */
    expect(await db.acctExpense.count({ where: { company: "byteforce" } })).toBe(0);
  });

  it("imports a line the old app could still add up — fidelity, not clamping", async () => {
    /* individually negative components that still net ≥ 0 are exactly what the
       SPA displayed: 5000 − (−1000) + (−2000) = 4000 EGP. The verify numbers
       have to reconcile against his old app, so they import untouched. */
    const summary = await importAccounting(
      {
        openingBalance: 0,
        expenses: [
          { id: "e2", month: M0, type: "payroll", name: "Odd", amount: 5000, deduction: -1000, bonus: -2000, paid: true },
        ],
      },
      "byteforce",
      actor,
    );
    expect(summary.companies[0]!.verify.treasuryNow).toBe(-400_000);
    expect(paidExpenseIn(await loadBooks("byteforce"), M0)).toBe(400_000);
  });

  it("refuses files that are not an accounting export", async () => {
    await expect(importAccounting({ hello: "world" }, "byteforce", actor)).rejects.toMatchObject({ status: 400 });
    await expect(importAccounting([1, 2, 3], "byteforce", actor)).rejects.toMatchObject({ status: 400 });
    await expect(importAccounting("{}", "byteforce", actor)).rejects.toMatchObject({ status: 400 });
  });

  it("writes one import mark per company into the activity log", async () => {
    await importAccounting(allCompaniesFile, null, actor);
    const logs = await db.activityLog.findMany({ where: { entityType: "acct_books" } });
    expect(logs.map((l) => l.entityId).sort()).toEqual(["bsystems", "byteforce"]);
    expect(logs.every((l) => l.action === "import" && l.trigger === "acct_import")).toBe(true);
  });
});
