import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { resetDb } from "@/tests/db-reset";
import { importAccounting, parseExportFile, type AcctCompanyDoc } from "./import";
import { exportAllDoc, exportCompanyDoc, exportFilename, exportAllFilename } from "./export";
import { addMonths, dashboard, type AcctBooks } from "./engine";
import { cairoMonth } from "./now";
import type { Actor } from "@/lib/services/activity";

/* ============================================================================
   ADR-054 round-trip proof (founder directive C "like the original project"):
   the module's export emits the ORIGINAL SPA's exact JSON shape — the one its
   own import (migrate()) accepts — so files move between the old and new
   systems in BOTH directions without a single derived number moving.

   Equality is proven where it matters: the ENGINE. parseExportFile IS the
   SPA-migrate-mirroring parser (ADR-052), so parsing any document and running
   dashboard() over it across every month either system carries gives the
   totals both apps would display. Ids are re-minted on import (cuids), so
   documents are compared by derived totals + collection counts, never by id.

   Fixture: the ADR-052 integration fixture's shape — every entity and edge
   (segments, linked manual payroll, deduction/bonus, media pass-through with
   mediaRef, loans with payments and the 50-piaster epsilon, payrollPaid incl.
   an orphan key, an on-hold expense, a fractional 1999.5 EGP). Plus, when the
   founder's real export file is present (backups/, gitignored), the same
   proof runs over the real books.
   ========================================================================== */

const actor: Actor = { id: null, label: "Roundtrip Admin" };

const M0 = cairoMonth();
const M1 = addMonths(M0, -1);
const M2 = addMonths(M0, -2);
const M3 = addMonths(M0, -3);

const byteforceDoc = {
  openingBalance: 2500,
  roster: [
    {
      id: "aya1", name: "Aya", role: "Designer", serviceLine: "branding",
      account: "100200300", since: M3, salary: 8000, active: true,
      segments: [
        { from: M3, salary: 6000, active: true },
        { from: M1, salary: 8000, active: true },
      ],
    },
    {
      id: "karim1", name: "Karim", role: "Editor", serviceLine: "video",
      account: "", since: M2, salary: 4000, active: false,
      segments: [
        { from: M2, salary: 4000, active: true },
        { from: M0, salary: 4000, active: false },
      ],
    },
  ],
  expenses: [
    { id: "old1", month: M3, type: "other", name: "Legacy", serviceLine: "", amount: 500, note: "" },
    { id: "extra1", month: M2, type: "payroll", name: "Contract QA", serviceLine: "", amount: 1000, deduction: 100, bonus: 50, note: "", paid: true, paidDate: `${M2}-20` },
    { id: "link1", month: M1, type: "payroll", name: "Aya", serviceLine: "branding", amount: 7500, note: "adjusted", paid: true, paidDate: `${M1}-28`, rosterId: "aya1" },
    { id: "rent1", month: M0, type: "rent", name: "Office", serviceLine: "", amount: 2000, note: "", paid: true, paidDate: `${M0}-01` },
    { id: "hold1", month: M0, type: "subscription", name: "Figma", serviceLine: "web", amount: 300, note: "", paid: false, paidDate: null },
    /* ADR-060 — the founder's additions: a normal-cost campaign expense tagged
       to the new bsystems department (both ids are OURS; the old app renders
       them raw but adds them up identically) */
    { id: "camp1", month: M0, type: "media_campaign", name: "Health campaign", serviceLine: "bsystems", amount: 1000, note: "", paid: true, paidDate: `${M0}-05` },
  ],
  income: [
    { id: "inv1", month: M2, type: "invoice", client: "Acme", serviceLine: "social", amount: 10000, note: "", collected: true, collectedDate: `${M2}-10`, paidMonth: M2 },
    { id: "inv2", month: M2, type: "invoice", client: "Acme", serviceLine: "social", amount: 5000, note: "", collected: true, collectedDate: `${M0}-05`, paidMonth: M0 },
    { id: "inv3", month: M0, type: "invoice", client: "Beta", serviceLine: "web", amount: 3000, note: "", collected: false, collectedDate: null, paidMonth: null },
    { id: "fee1", month: M1, type: "media_fee", client: "Gamma", serviceLine: "media_fee", amount: 1500, note: "Media fee (budget)", collected: true, collectedDate: `${M1}-03`, paidMonth: M1, mediaRef: "md1" },
    /* ADR-060 — income tagged to the new bsystems department */
    { id: "bsy1", month: M0, type: "invoice", client: "Delta", serviceLine: "bsystems", amount: 2500, note: "", collected: true, collectedDate: `${M0}-06`, paidMonth: M0 },
  ],
  treasury: [
    { id: "t1", month: M1, kind: "deposit", label: "Client ad budget held — Gamma", amount: 8500, date: `${M1}-03`, tag: "media" },
    { id: "t2", month: M1, kind: "withdraw", label: "Ad spend to buyer — Gamma", amount: 6000, date: `${M1}-15`, tag: "media" },
    { id: "t3", month: M2, kind: "deposit", label: "Loan received — Owner", amount: 20000, date: `${M2}-01`, tag: "loan" },
    { id: "t5", month: M1, kind: "withdraw", label: "Loan repayment — Owner", amount: 5000, date: `${M1}-10`, tag: "loan" },
    { id: "t4", month: M3, kind: "withdraw", label: "Owner draw", amount: 1000, date: `${M3}-20`, tag: "" },
  ],
  loans: [
    { id: "l1", direction: "borrowed", party: "Owner", principal: 20000, date: `${M2}-01`, dueDate: "", note: "", payments: [{ id: "p1", amount: 5000, date: `${M1}-10`, note: "" }] },
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
    [`${M2}:ghost`]: `${M2}-28`, // orphan — dropped on import, arithmetically neutral
  },
  _savedAt: 1765000000000,
};

const bsystemsDoc = {
  openingBalance: 0,
  roster: [],
  expenses: [
    { id: "b1", month: M0, type: "admin", name: "Hosting", serviceLine: "", amount: 200, note: "", paid: false, paidDate: null },
    /* ADR-060 — media_campaign is NOT hidden for bsystems (only the
       pass-through "media" type is) */
    { id: "b3", month: M0, type: "media_campaign", name: "Own campaign", serviceLine: "", amount: 300, note: "", paid: true, paidDate: `${M0}-02` },
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

const allCompaniesFile = { byteforce: byteforceDoc, bsystems: bsystemsDoc };

/* ------------------------------------------------------------------ helpers */

/** every month either document could possibly affect, padded a month each way */
const MONTHS = [addMonths(M3, -1), M3, M2, M1, M0, addMonths(M0, 1)];

/** a parsed export document IS engine-shaped (parseExportFile mirrors
    migrate(): segments synthesized, money in piasters, arrays coerced) */
function asBooks(doc: AcctCompanyDoc): AcctBooks {
  return {
    openingBalance: doc.openingBalance,
    roster: doc.roster.map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      serviceLine: r.serviceLine,
      account: r.account,
      since: r.since ?? M0,
      segments:
        r.segments.length > 0
          ? [...r.segments].sort((a, b) => (a.from < b.from ? -1 : 1))
          : [{ from: r.since ?? M0, salary: r.salary, active: r.active }],
    })),
    income: doc.income.map((i) => ({ ...i })),
    expenses: doc.expenses.map((e) => ({ ...e })),
    treasury: doc.treasury.map((t) => ({ ...t })),
    loans: doc.loans.map((l) => ({ ...l, payments: [...l.payments] })),
    mediaLedger: doc.mediaLedger.map((m) => ({ ...m })),
    targets: doc.targets.map((t) => ({ ...t })),
    payrollPaid: Object.fromEntries(
      Object.entries(doc.payrollPaid).filter((e): e is [string, string] => typeof e[1] === "string"),
    ),
  };
}

/** the totals both apps display, for every month in scope */
function totalsOf(raw: unknown, company: "byteforce" | "bsystems"): unknown[] {
  const doc = parseExportFile(raw, company).companies.find((c) => c.company === company)!.doc;
  const books = asBooks(doc);
  return MONTHS.map((m) => dashboard(books, m, M0));
}

function countsOf(raw: unknown, company: "byteforce" | "bsystems") {
  const doc = parseExportFile(raw, company).companies.find((c) => c.company === company)!.doc;
  return {
    income: doc.income.length,
    expenses: doc.expenses.length,
    roster: doc.roster.length,
    segments: doc.roster.reduce((s, r) => s + Math.max(1, r.segments.length), 0),
    treasury: doc.treasury.length,
    loans: doc.loans.length,
    loanPayments: doc.loans.reduce((s, l) => s + l.payments.length, 0),
    media: doc.mediaLedger.length,
    targets: doc.targets.length,
    payrollMarks: Object.keys(doc.payrollPaid).length,
  };
}

beforeEach(async () => {
  await resetDb();
});

/* ADR-074 — `importAccounting` takes the caller's COMPANIES: a wrapper file
   may only replace books the account holds. These tests pass the original
   pair, so every assertion below means exactly what it meant before. */
describe("accounting export — the SPA's own shape, round-tripping in both directions", () => {
  it("export emits the migrate() state shape with EGP numbers and in-file link integrity", async () => {
    await importAccounting(allCompaniesFile, null, ["byteforce", "bsystems"], actor);
    const doc = (await exportCompanyDoc("byteforce")) as unknown as Record<string, unknown>;

    /* the SPA state's exact key set — nothing extra, nothing missing */
    expect(Object.keys(doc).sort()).toEqual(
      ["expenses", "income", "loans", "mediaLedger", "openingBalance", "payrollPaid", "roster", "targets", "treasury"].sort(),
    );
    expect(doc["_rev"]).toBeUndefined();
    expect(doc["_savedAt"]).toBeUndefined();

    /* money is EGP numbers again (2500 opening, the fractional 1999.5 intact) */
    expect(doc["openingBalance"]).toBe(2500);
    const loans = doc["loans"] as Array<{ direction: string; payments: Array<{ amount: number }> }>;
    expect(loans.find((l) => l.direction === "lent")!.payments[0]!.amount).toBe(1999.5);

    /* in-file link integrity: rosterId, mediaRef and payrollPaid keys resolve
       against ids in the SAME file (re-minted cuids are fine — the SPA treats
       ids as opaque) */
    const roster = doc["roster"] as Array<{ id: string; segments: unknown[] }>;
    const rosterIds = new Set(roster.map((r) => r.id));
    const expenses = doc["expenses"] as Array<{ rosterId?: string; deduction?: number; bonus?: number; paid: boolean }>;
    for (const e of expenses) if (e.rosterId) expect(rosterIds.has(e.rosterId)).toBe(true);
    const mediaIds = new Set((doc["mediaLedger"] as Array<{ id: string }>).map((m) => m.id));
    const income = doc["income"] as Array<{ mediaRef?: string }>;
    for (const i of income) if (i.mediaRef) expect(mediaIds.has(i.mediaRef)).toBe(true);
    for (const key of Object.keys(doc["payrollPaid"] as Record<string, string>)) {
      expect(rosterIds.has(key.split(":")[1]!)).toBe(true); // the orphan died on import
    }

    /* legacy shape details the SPA writes: linked payroll carries rosterId,
       optional fields are OMITTED when absent, deduction/bonus survive */
    expect(expenses.some((e) => e.rosterId)).toBe(true);
    expect(expenses.some((e) => e.deduction === 100 && e.bonus === 50)).toBe(true);
    expect(expenses.some((e) => "deduction" in e && e.deduction == null)).toBe(false);
    /* the on-hold expense keeps paid:false + paidDate:null (explicit null) */
    const hold = expenses.find((e) => !e.paid)!;
    expect(hold).toBeDefined();
    expect((hold as Record<string, unknown>)["paidDate"]).toBeNull();
  });

  it("old file → import → export: every derived total identical, every month (both companies)", async () => {
    await importAccounting(allCompaniesFile, null, ["byteforce", "bsystems"], actor);
    const exported = await exportAllDoc(["byteforce", "bsystems"]);

    for (const company of ["byteforce", "bsystems"] as const) {
      expect(totalsOf(exported, company)).toEqual(totalsOf(allCompaniesFile, company));
      expect(countsOf(exported, company)).toEqual({
        ...countsOf(allCompaniesFile, company),
        /* the orphan payrollPaid key is the ONE legitimate difference */
        payrollMarks: countsOf(allCompaniesFile, company).payrollMarks - (company === "byteforce" ? 1 : 0),
      });
    }
  });

  it("export → import → export is a fixpoint (totals and counts stable)", async () => {
    await importAccounting(allCompaniesFile, null, ["byteforce", "bsystems"], actor);
    const first = await exportAllDoc(["byteforce", "bsystems"]);

    await resetDb();
    await importAccounting(first as unknown, null, ["byteforce", "bsystems"], actor);
    const second = await exportAllDoc(["byteforce", "bsystems"]);

    for (const company of ["byteforce", "bsystems"] as const) {
      expect(totalsOf(second, company)).toEqual(totalsOf(first, company));
      expect(countsOf(second, company)).toEqual(countsOf(first, company));
    }
  });

  it("ADR-060 — the new ids survive the round trip verbatim, no mapping, no fallback", async () => {
    await importAccounting(allCompaniesFile, null, ["byteforce", "bsystems"], actor);
    const doc = (await exportCompanyDoc("byteforce")) as unknown as Record<string, unknown>;
    const expenses = doc["expenses"] as Array<{ type: string; serviceLine: string; name: string }>;
    const camp = expenses.find((e) => e.name === "Health campaign")!;
    expect(camp.type).toBe("media_campaign");
    expect(camp.serviceLine).toBe("bsystems");
    const income = doc["income"] as Array<{ serviceLine: string; client: string }>;
    expect(income.some((i) => i.serviceLine === "bsystems")).toBe(true);
    /* the type the founder wants available EVERYWHERE really is in the
       B-Systems books too */
    const bs = (await exportCompanyDoc("bsystems")) as unknown as Record<string, unknown>;
    expect((bs["expenses"] as Array<{ type: string }>).some((e) => e.type === "media_campaign")).toBe(true);
  });

  it("filenames match the SPA's own (tenant/all + Cairo date)", () => {
    const stamp = /^\d{4}-\d{2}-\d{2}$/;
    expect(exportFilename("byteforce")).toMatch(/^byteforce-accounting-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exportFilename("bsystems")).toMatch(/^bsystems-accounting-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exportAllFilename()).toMatch(/^all-companies-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exportFilename("byteforce").slice("byteforce-accounting-".length, -5)).toMatch(stamp);
  });

  const realFile = path.resolve(__dirname, "../../../backups/all-companies-2026-08-17.json");
  it.skipIf(!existsSync(realFile))(
    "the founder's REAL export round-trips with identical totals",
    async () => {
      const raw = JSON.parse(readFileSync(realFile, "utf8")) as Record<string, unknown>;
      await importAccounting(raw, null, ["byteforce", "bsystems"], actor);
      const exported = await exportAllDoc(["byteforce", "bsystems"]);
      for (const company of ["byteforce", "bsystems"] as const) {
        if (!(company in raw)) continue;
        expect(totalsOf(exported, company)).toEqual(totalsOf(raw, company));
      }
    },
  );
});
