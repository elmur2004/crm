import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LOCALES } from "@/lib/i18n/core";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import type { CurrentUser } from "@/lib/auth/guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { startOfCairoDay } from "@/lib/datetime";
import { CRM_COMPANIES, CRM_ROLES, crmRolesFor, resolveCompany } from "./company";
import {
  IMPORT_EXAMPLE,
  IMPORT_FIELDS,
  LEAD_CREATE_ROLES,
  canImportLeads,
  fileErrorMsgs,
  importHeaderRow,
  leadsImportHref,
  leadsImportTemplateHref,
  skipReasonMsg,
  type ImportField,
  type SkipReason,
} from "./leads-import";
import {
  SpreadsheetNumber,
  countDataRows,
  foldDigits,
  matchImportHeaders,
  phoneKey,
  planImport,
  readImportCreatedDate,
  readImportNumber,
  readImportType,
  rowsFromSheet,
  type ImportCell,
  type ImportRow,
} from "./leads-import-plan";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the pure rules, one by one.

   The wall is tested the way ADR-083 tested the export's: as an EQUIVALENCE
   with the page's own guard, rebuilt from the functions the page calls, swept
   over every role subset — never as a second copy of a table.
   ========================================================================== */

function asUser(roles: Role[]): CurrentUser {
  return {
    id: "u1",
    name: "Test",
    roles,
    portalRepId: null,
    impersonatorId: null,
    canAccessAccounting: true,
    canAccessVault: true,
  };
}

/** Can these roles OPEN this company's Leads page? Transcribed step for step
    from src/app/(bsystems)/b-systems/(app)/leads/page.tsx (the export test's
    own transcription, repeated so this file fails on its own). */
function pageReaches(roles: Role[], company: (typeof CRM_COMPANIES)[number]): boolean {
  if (!roles.some((r) => CRM_ROLES.includes(r))) return false;
  const resolved = resolveCompany(roles, company);
  if (resolved.kind !== "ok" || resolved.company !== company) return false;
  if (company === "byteforce") return true;
  if (!crmRolesFor("bsystems").some((r) => roles.includes(r))) return false;
  return crmEngineRole("bsystems", asUser(roles)) === "bsystems_admin";
}

function allRoleSubsets(): Role[][] {
  const out: Role[][] = [];
  for (let mask = 0; mask < 1 << ROLES.length; mask++) {
    out.push(ROLES.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

/* ---------------------------------------------------------------- the wall */

describe("the import wall = can open that company's Leads page AND may create leads there", () => {
  it("matches the page ∩ the create list for every role subset and both companies", () => {
    const subsets = allRoleSubsets();
    expect(subsets).toHaveLength(64);
    for (const roles of subsets) {
      for (const company of CRM_COMPANIES) {
        const creates = LEAD_CREATE_ROLES[company].some((r) => roles.includes(r));
        expect(canImportLeads(roles, company), `[${roles.join(",") || "none"}] → ${company}`).toBe(
          pageReaches(roles, company) && creates,
        );
      }
    }
  });

  it("admits exactly byteforce_staff for ByteForce and bsystems_admin for B-Systems", () => {
    for (const role of ROLES) {
      expect(canImportLeads([role], "byteforce"), role).toBe(role === "byteforce_staff");
      expect(canImportLeads([role], "bsystems"), role).toBe(role === "bsystems_admin");
    }
  });

  it("the roles that can CREATE a B-Systems lead but not open its Leads page get no import", () => {
    /* sales, agents and partners are sent to their own board; data entry has
       one destination (ADR-051) — a whole file is not "adding a lead" */
    for (const role of ["bsystems_sales", "bsystems_agent", "bsystems_partner", "bsystems_data_entry"] as Role[]) {
      expect(LEAD_CREATE_ROLES.bsystems).toContain(role);
      expect(canImportLeads([role], "bsystems"), role).toBe(false);
    }
  });

  it("holding both companies is not importing into both", () => {
    expect(canImportLeads(["bsystems_sales", "byteforce_staff"], "byteforce")).toBe(true);
    expect(canImportLeads(["bsystems_sales", "byteforce_staff"], "bsystems")).toBe(false);
    expect(canImportLeads(["bsystems_admin", "byteforce_staff"], "bsystems")).toBe(true);
    expect(canImportLeads(["bsystems_admin", "byteforce_staff"], "byteforce")).toBe(true);
  });

  it("the B-Systems create list is the create ROUTE's own requireRole list", () => {
    /* drift guard: read the route's source rather than trusting the copy */
    const src = readFileSync(
      path.resolve(process.cwd(), "src/app/api/b-systems/leads/route.ts"),
      "utf8",
    );
    const call = /requireRole\(([\s\S]*?)\)/.exec(src)?.[1] ?? "";
    const listed = [...call.matchAll(/"(\w+)"/g)].map((m) => m[1]);
    expect([...listed].sort()).toEqual([...LEAD_CREATE_ROLES.bsystems].sort());
  });

  it("the company is the ROUTE — no query string on either address", () => {
    expect(leadsImportHref("bsystems")).toBe("/api/b-systems/leads/import");
    expect(leadsImportHref("byteforce")).toBe("/api/byteforce/leads/import");
    expect(leadsImportTemplateHref("bsystems")).toBe("/api/b-systems/leads/import/template");
    expect(leadsImportTemplateHref("byteforce")).toBe("/api/byteforce/leads/import/template");
    for (const c of CRM_COMPANIES) {
      expect(leadsImportHref(c)).not.toContain("?");
      expect(leadsImportTemplateHref(c)).not.toContain("?");
    }
  });
});

/* ------------------------------------------------------------- the columns */

describe("the template's columns", () => {
  it("are the create inputs (no sales rep), required ones starred, per company", () => {
    expect(importHeaderRow("bsystems")).toEqual([
      "Name*",
      "Number*",
      "Type*",
      "Email",
      "Company*",
      "Position",
      "Industry",
      "Requirements",
      "Description",
      "Created date",
    ]);
    /* ByteForce's create rule does not require the company */
    expect(importHeaderRow("byteforce")[4]).toBe("Company");
    expect(IMPORT_FIELDS).not.toContain("salesRepId" as ImportField);
  });
});

/* -------------------------------------------------------- the phone number */

describe("the phone rule — the house normaliser, and the leading zero", () => {
  const ok = (cell: ImportCell) => {
    const r = readImportNumber(cell);
    if (!r.ok) throw new Error(`refused ${String(cell)}: ${r.reason}`);
    return r;
  };

  it("keeps a text number exactly, normalised like every other phone in the product", () => {
    expect(ok("01012345678").number).toBe("01012345678");
    expect(ok("010 1234-5678").number).toBe("01012345678");
    expect(ok("(010) 1234.5678").number).toBe("01012345678");
    expect(ok("+20 101 234 5678").number).toBe("+201012345678");
    expect(ok("00201012345678").number).toBe("+201012345678");
    expect(ok("0221000001").number).toBe("0221000001"); // a Cairo landline
    expect(ok("01012345678").restored).toBeNull();
  });

  it("reads Arabic-Indic digits and a forcing apostrophe", () => {
    expect(foldDigits("٠١٠١٢٣٤٥٦٧٨")).toBe("01012345678");
    expect(ok("٠١٠١٢٣٤٥٦٧٨").number).toBe("01012345678");
    expect(ok("۰۱۰۱۲۳۴۵۶۷۸").number).toBe("01012345678");
    expect(ok("'01012345678").number).toBe("01012345678");
  });

  it("A NUMERIC cell: a 10-digit Egyptian mobile gets its 0 back, and says so", () => {
    for (const cell of [new SpreadsheetNumber("1012345678"), 1012345678]) {
      const r = ok(cell);
      expect(r.number).toBe("01012345678");
      expect(r.restored).toEqual({ from: "1012345678" });
    }
    for (const prefix of ["10", "11", "12", "15"]) {
      expect(ok(new SpreadsheetNumber(`${prefix}12345678`)).number).toBe(`0${prefix}12345678`);
    }
  });

  it("A NUMERIC cell: +20 1X… that Excel read as a number gets its + back", () => {
    const r = ok(new SpreadsheetNumber("201012345678"));
    expect(r.number).toBe("+201012345678");
    expect(r.restored).toEqual({ from: "201012345678" });
  });

  it("A NUMERIC cell of any OTHER shape is refused — no digit is invented", () => {
    /* 0221000001 as a number: was it a landline or a nine-digit foreign number? */
    for (const raw of ["221000001", "1312345678", "966501234567", "12345", "1912345678"]) {
      const r = readImportNumber(new SpreadsheetNumber(raw));
      expect(r.ok, raw).toBe(false);
      if (!r.ok) {
        expect(r.reason).toBe("numberStoredAsNumber");
        expect(r.value).toBe(raw);
      }
    }
    /* not an integer at all */
    expect(readImportNumber(new SpreadsheetNumber("1012345678.5"))).toMatchObject({ ok: false, reason: "invalidNumber" });
    expect(readImportNumber(new SpreadsheetNumber("-1012345678"))).toMatchObject({ ok: false, reason: "invalidNumber" });
  });

  it("the 10-digit repair applies to a text cell too (a paste of values that already lost it)", () => {
    const r = ok("1012345678");
    expect(r.number).toBe("01012345678");
    expect(r.restored).toEqual({ from: "1012345678" });
  });

  it("refuses what is not a phone, and calls an empty cell missing", () => {
    expect(readImportNumber("")).toMatchObject({ ok: false, reason: "missingNumber" });
    expect(readImportNumber(null)).toMatchObject({ ok: false, reason: "missingNumber" });
    expect(readImportNumber("   ")).toMatchObject({ ok: false, reason: "missingNumber" });
    expect(readImportNumber("call me")).toMatchObject({ ok: false, reason: "invalidNumber" });
    expect(readImportNumber("123")).toMatchObject({ ok: false, reason: "invalidNumber" });
    expect(readImportNumber("0101234567890123456")).toMatchObject({ ok: false, reason: "invalidNumber" });
    expect(readImportNumber(new Date())).toMatchObject({ ok: false, reason: "invalidNumber" });
  });
});

describe("the duplicate key — every spelling of one line meets", () => {
  it("one Egyptian mobile, five spellings, one key", () => {
    const key = phoneKey("01012345678");
    for (const s of ["010 1234 5678", "+201012345678", "+20 101 234 5678", "00201012345678", "201012345678", "1012345678", "٠١٠١٢٣٤٥٦٧٨"]) {
      expect(phoneKey(s), s).toBe(key);
    }
  });

  it("different numbers stay different, and a landline is never matched by a guess", () => {
    expect(phoneKey("01012345678")).not.toBe(phoneKey("01012345679"));
    expect(phoneKey("0221000001")).toBe(phoneKey("02 2100 0001"));
    expect(phoneKey("0221000001")).not.toBe(phoneKey("+20221000001"));
  });

  it("a junk stored number has an empty key, which matches nothing", () => {
    expect(phoneKey("N/A")).toBe("");
  });
});

/* -------------------------------------------------------------- the type */

describe("the type", () => {
  it("reads the key, the English label and the Arabic label, any case or spacing", () => {
    expect(readImportType("Cold call")).toBe("cold_call");
    expect(readImportType("cold_call")).toBe("cold_call");
    expect(readImportType("  COLD   CALL ")).toBe("cold_call");
    expect(readImportType("Event data")).toBe("event_data");
    expect(readImportType("personal-connection")).toBe("personal_connection");
    expect(readImportType("اتصال مباشر")).toBe("cold_call");
    expect(readImportType("Organic")).toBe("organic");
  });
  it("an unknown type is refused, an empty one is missing", () => {
    expect(readImportType("Walk in")).toBeNull();
    expect(readImportType("")).toBe("missing");
    expect(readImportType(null)).toBe("missing");
  });
});

/* ------------------------------------------------------------- the headers */

describe("the header row", () => {
  it("accepts the template's own headers, starred or not, in any order", () => {
    const m = matchImportHeaders(importHeaderRow("bsystems"), "bsystems");
    expect(m.ok).toBe(true);
    const shuffled = matchImportHeaders(["type", "NUMBER", " Name ", "Company"], "bsystems");
    expect(shuffled).toEqual({ ok: true, columns: { type: 0, number: 1, name: 2, companyName: 3 } });
  });

  it("refuses a file missing a required column, naming it", () => {
    const m = matchImportHeaders(["Name*", "Number*", "Type*"], "bsystems");
    expect(m).toEqual({ ok: false, missing: ["Company*"], unexpected: [], duplicated: [] });
    /* ByteForce does not require the company */
    expect(matchImportHeaders(["Name*", "Number*", "Type*"], "byteforce").ok).toBe(true);
  });

  it("refuses a column the template does not have — e.g. the EXPORT file", () => {
    const exportHeaders = ["Name", "Company", "Number", "Email", "Type", "Stage", "Status"];
    const m = matchImportHeaders(exportHeaders, "bsystems");
    expect(m.ok).toBe(false);
    if (!m.ok) expect(m.unexpected).toEqual(["Stage", "Status"]);
  });

  it("refuses a column given twice", () => {
    const m = matchImportHeaders(["Name", "Number", "Type", "Number"], "byteforce");
    expect(m).toEqual({ ok: false, missing: [], unexpected: [], duplicated: ["Number"] });
  });

  it("ignores the skipped-rows file's two report columns, so it can be re-imported", () => {
    expect(matchImportHeaders([...importHeaderRow("byteforce"), "Row", "Skipped because"], "byteforce").ok).toBe(true);
  });
});

/* -------------------------------------------------------- the created date */

describe("the created date — a Cairo calendar day, through lib/datetime.ts", () => {
  const NOW = new Date("2026-10-25T09:00:00.000Z");

  it("blank = no date (the lead is dated the moment of the import)", () => {
    expect(readImportCreatedDate(null, NOW)).toEqual({ ok: true, day: null, at: null });
    expect(readImportCreatedDate("", NOW)).toEqual({ ok: true, day: null, at: null });
  });

  it("text DD/MM/YYYY is read DAY-FIRST, and YYYY-MM-DD is read too", () => {
    for (const text of ["15/03/2024", "15-03-2024", "15.03.2024", "2024-03-15", "١٥/٠٣/٢٠٢٤"]) {
      const r = readImportCreatedDate(text, NOW);
      expect(r, text).toEqual({ ok: true, day: "2024-03-15", at: startOfCairoDay("2024-03-15") });
    }
    /* 05/03 is the FIFTH of March — the template says DD/MM/YYYY */
    expect(readImportCreatedDate("05/03/2024", NOW)).toMatchObject({ ok: true, day: "2024-03-05" });
  });

  it("the stored instant is the START of that day in Cairo (UTC 22:00 the eve, in winter)", () => {
    const r = readImportCreatedDate("15/01/2024", NOW);
    expect(r.ok && r.at?.toISOString()).toBe("2024-01-14T22:00:00.000Z");
  });

  it("a DATE cell (what read-excel-file returns for a date-formatted cell) keeps its calendar day", () => {
    /* read-excel-file hands back the wall clock pinned to UTC — even 23:30
       must stay on the 15th, not slide into the 16th */
    expect(readImportCreatedDate(new Date("2024-03-15T00:00:00.000Z"), NOW)).toMatchObject({ ok: true, day: "2024-03-15" });
    expect(readImportCreatedDate(new Date("2024-03-15T23:30:00.000Z"), NOW)).toMatchObject({ ok: true, day: "2024-03-15" });
  });

  it("a SERIAL (a date in a General cell) is Excel's 1900 day count", () => {
    expect(readImportCreatedDate(new SpreadsheetNumber("45366"), NOW)).toMatchObject({ ok: true, day: "2024-03-15" });
    expect(readImportCreatedDate(new SpreadsheetNumber("36526"), NOW)).toMatchObject({ ok: true, day: "2000-01-01" });
    expect(readImportCreatedDate(new SpreadsheetNumber("45366.75"), NOW)).toMatchObject({ ok: true, day: "2024-03-15" });
  });

  it("refuses a day in the FUTURE — never clamps it", () => {
    expect(readImportCreatedDate("26/10/2026", NOW)).toEqual({
      ok: false,
      reason: { code: "futureDate", date: "2026-10-26" },
    });
    /* today is fine — Cairo's today, not UTC's */
    expect(readImportCreatedDate("25/10/2026", NOW)).toMatchObject({ ok: true, day: "2026-10-25" });
    const lateUtc = new Date("2026-10-25T22:30:00.000Z"); // already the 26th in Cairo
    expect(readImportCreatedDate("26/10/2026", lateUtc)).toMatchObject({ ok: true, day: "2026-10-26" });
  });

  it("refuses an obviously wrong day (before 2000) — never clamps it", () => {
    expect(readImportCreatedDate("31/12/1999", NOW)).toEqual({
      ok: false,
      reason: { code: "tooOldDate", date: "1999-12-31" },
    });
    /* "2024" typed into a General cell is serial 2024 — a day in 1905 */
    expect(readImportCreatedDate(new SpreadsheetNumber("2024"), NOW)).toMatchObject({
      ok: false,
      reason: { code: "tooOldDate" },
    });
  });

  it("refuses what is not a date, including a day that does not exist and US order", () => {
    for (const text of ["31/02/2024", "03/15/2024", "yesterday", "15/03/24", "2024/13/01", "00/01/2024"]) {
      expect(readImportCreatedDate(text, NOW), text).toEqual({
        ok: false,
        reason: { code: "invalidDate", value: text },
      });
    }
  });
});

/* ----------------------------------------------------------------- the plan */

const BS = "bsystems" as const;

function sheetRows(rows: ImportCell[][]): ImportRow[] {
  const header = importHeaderRow(BS);
  const match = matchImportHeaders(header, BS);
  if (!match.ok) throw new Error("template headers refused");
  return rowsFromSheet([header, ...rows], match.columns);
}

/** Name, Number, Type, Email, Company, Position, Industry, Requirements, Description, Created date */
const r = (name: ImportCell, number: ImportCell, type: ImportCell = "Cold call", more: ImportCell[] = []) => [
  name,
  number,
  type,
  more[0] ?? null,
  more[1] ?? "Acme",
  more[2] ?? null,
  more[3] ?? null,
  more[4] ?? null,
  more[5] ?? null,
  more[6] ?? null,
];

const NOW = new Date("2026-10-25T09:00:00.000Z");
const codes = (reasons: SkipReason[]) => reasons.map((x) => x.code);

describe("planning an import", () => {
  it("row numbers are Excel's (header = row 1), blank rows vanish, the example is skipped", () => {
    const rows = sheetRows([
      IMPORT_FIELDS.map((f) => IMPORT_EXAMPLE[f]),
      r("Ahmed", "01011111111"),
      [null, null, null],
      r("Sara", "01022222222"),
    ]);
    const plan = planImport(rows, BS, [], NOW);
    expect(plan.planned.map((p) => p.row)).toEqual([3, 5]);
    expect(plan.skipped).toHaveLength(1);
    expect(plan.skipped[0]).toMatchObject({ row: 2, reasons: [{ code: "example" }] });
    expect(countDataRows(rows)).toBe(2);
  });

  it("every validation rule, each with its reason — all of a row's problems at once", () => {
    const plan = planImport(
      sheetRows([
        r(null, "01011111111"), // 2 missing name
        r("No Number", null), // 3
        r("Bad Number", "call me"), // 4
        r("Numeric", new SpreadsheetNumber("221000001")), // 5
        r("No Type", "01033333333", null), // 6
        r("Odd Type", "01044444444", "Walk in"), // 7
        r("No Company", "01055555555", "Cold call", [null, ""]), // 8
        r("Bad Email", "01066666666", "Cold call", ["not-an-email"]), // 9
        r("x".repeat(201), "01077777777"), // 10
        r("Bad Date", "01088888888", "Cold call", [null, "Acme", null, null, null, null, "31/02/2024"]), // 11
        r(null, null, null, [null, ""]), // 12 — but not blank: Company was cleared, Email null... (blank → vanishes)
        r("", "", "Walk in"), // 13 — three problems
      ]),
      BS,
      [],
      NOW,
    );
    const byRow = Object.fromEntries(plan.skipped.map((s) => [s.row, codes(s.reasons)]));
    expect(byRow).toEqual({
      2: ["missingName"],
      3: ["missingNumber"],
      4: ["invalidNumber"],
      5: ["numberStoredAsNumber"],
      6: ["missingType"],
      7: ["unknownType"],
      8: ["missingCompany"],
      9: ["invalidEmail"],
      10: ["tooLong"],
      11: ["invalidDate"],
      13: ["missingName", "missingNumber", "unknownType"],
    });
    expect(plan.skipped.find((s) => s.row === 10)!.reasons[0]).toEqual({ code: "tooLong", field: "name", max: 200 });
    expect(plan.planned).toEqual([]);
  });

  it("ByteForce does not require the company; B-Systems does", () => {
    const noCompany = [r("Walk In", "01011111111", "Cold call", [null, ""])];
    expect(planImport(sheetRows(noCompany), "byteforce", [], NOW).planned).toHaveLength(1);
    expect(codes(planImport(sheetRows(noCompany), BS, [], NOW).skipped[0]!.reasons)).toEqual(["missingCompany"]);
  });

  it("a number ALREADY IN THE SYSTEM is skipped — whatever its spelling — naming the lead", () => {
    const plan = planImport(
      sheetRows([r("New Ahmed", "+20 101 111 1111"), r("Fresh", "01099999999")]),
      BS,
      [{ number: "010 1111 1111", name: "Ahmed (existing)" }],
      NOW,
    );
    expect(plan.planned.map((p) => p.input.name)).toEqual(["Fresh"]);
    expect(plan.skipped[0]).toMatchObject({
      row: 2,
      reasons: [{ code: "duplicateInSystem", existingName: "Ahmed (existing)" }],
    });
  });

  it("a number REPEATED IN THE FILE: the first good row goes in, the repeats are skipped", () => {
    const plan = planImport(
      sheetRows([
        r("First", "01011111111"),
        r("Second", "010 1111 1111"),
        r("Third", new SpreadsheetNumber("1011111111")),
      ]),
      BS,
      [],
      NOW,
    );
    expect(plan.planned.map((p) => p.row)).toEqual([2]);
    expect(plan.skipped.map((s) => [s.row, s.reasons])).toEqual([
      [3, [{ code: "duplicateInFile", firstRow: 2 }]],
      [4, [{ code: "duplicateInFile", firstRow: 2 }]],
    ]);
  });

  it("…and an INVALID first copy does not block a later good one", () => {
    const plan = planImport(
      sheetRows([r("Bad", "01011111111", "Walk in"), r("Good", "01011111111")]),
      BS,
      [],
      NOW,
    );
    expect(plan.planned.map((p) => p.row)).toEqual([3]);
    expect(codes(plan.skipped[0]!.reasons)).toEqual(["unknownType"]);
  });

  it("hands createLead the PARSED input, unassigned (no sales rep), with the date or null", () => {
    const plan = planImport(
      sheetRows([
        r("Mona", new SpreadsheetNumber("1012345678"), "Event data", ["mona@x.com", "Acme", "CEO", "Retail", "A site", "Expo", "15/03/2024"]),
        r("Omar", "01055555555"),
      ]),
      BS,
      [],
      NOW,
    );
    expect(plan.planned[0]!.input).toEqual({
      name: "Mona",
      number: "01012345678",
      type: "event_data",
      email: "mona@x.com",
      companyName: "Acme",
      position: "CEO",
      industry: "Retail",
      requirements: "A site",
      description: "Expo",
    });
    expect(plan.planned[0]!.input).not.toHaveProperty("salesRepId");
    expect(plan.planned[0]!.createdAt).toEqual(startOfCairoDay("2024-03-15"));
    expect(plan.planned[1]!.createdAt).toBeNull();
    /* the repair is REPORTED, by row */
    expect(plan.restored).toEqual([{ row: 2, from: "1012345678", to: "01012345678" }]);
  });

  it("a future created date skips the row with its reason", () => {
    const plan = planImport(
      sheetRows([r("Tomorrow", "01011111111", "Cold call", [null, "Acme", null, null, null, null, "26/10/2026"])]),
      BS,
      [],
      NOW,
    );
    expect(plan.planned).toEqual([]);
    expect(plan.skipped[0]!.reasons).toEqual([{ code: "futureDate", date: "2026-10-26" }]);
  });
});

/* ---------------------------------------------------------------- the words */

describe("every reason and every refusal has real words in both languages", () => {
  const reasons: SkipReason[] = [
    { code: "example" },
    { code: "missingName" },
    { code: "missingNumber" },
    { code: "invalidNumber", value: "x" },
    { code: "numberStoredAsNumber", value: "221000001" },
    { code: "missingType" },
    { code: "unknownType", value: "Walk in" },
    { code: "missingCompany" },
    { code: "invalidEmail", value: "x" },
    { code: "invalidDate", value: "x" },
    { code: "futureDate", date: "2026-10-26" },
    { code: "tooOldDate", date: "1999-12-31" },
    { code: "tooLong", field: "name", max: 200 },
    { code: "invalidValue", field: "email" },
    { code: "duplicateInSystem", existingName: "Ahmed" },
    { code: "duplicateInFile", firstRow: 2 },
  ];

  it.each(reasons.map((x) => [x.code, x] as const))("%s", (_code, reason) => {
    for (const company of CRM_COMPANIES) {
      const msg = skipReasonMsg(reason, company);
      for (const locale of LOCALES) {
        expect(msg[locale].trim().length, `${reason.code}/${locale}`).toBeGreaterThan(3);
        expect(msg[locale]).not.toMatch(/\{\w+\}/); // nothing left un-filled
      }
      expect(msg.ar).not.toBe(msg.en);
    }
  });

  it("the duplicate reason names the company and the existing lead", () => {
    expect(skipReasonMsg({ code: "duplicateInSystem", existingName: "Ahmed" }, "bsystems").en).toBe(
      "Already in B-Systems — this number belongs to “Ahmed”",
    );
    expect(skipReasonMsg({ code: "futureDate", date: "2026-10-26" }, "bsystems").en).toBe(
      "The created date 26/10/2026 is in the future",
    );
  });

  it("every file refusal resolves in both languages", () => {
    for (const code of ["no_file", "not_xlsx", "too_large", "too_many_rows", "wrong_template", "wrong_company", "empty", "unreadable", "failed"] as const) {
      const msgs = fileErrorMsgs({ error: "", code, rows: 1001, missing: ["Name*"], otherCompany: "byteforce" }, "bsystems");
      expect(msgs.length, code).toBeGreaterThan(0);
      for (const msg of msgs) {
        for (const locale of LOCALES) expect(msg[locale]).not.toMatch(/\{\w+\}/);
        expect(msg.ar).not.toBe(msg.en);
      }
    }
    expect(fileErrorMsgs({ error: "", code: "wrong_company", otherCompany: "byteforce" }, "bsystems")[0]!.en).toBe(
      "This is the ByteForce template, and you are importing into B-Systems. Download the B-Systems template, or switch to ByteForce first.",
    );
  });
});
