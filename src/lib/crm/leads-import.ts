import { formatMsg, type Msg } from "@/lib/i18n/core";
import { common } from "@/lib/i18n/dict/crm";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { leadTypeMsgs } from "@/lib/i18n/dict/labels";
import { leadsImport as m } from "@/lib/i18n/dict/leads-import";
import { LEAD_TYPES, type Role } from "@/lib/pipeline-engine/constants";
import type { CrmCompany } from "./company";
import { canExportLeads } from "./leads-export";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the pure, CLIENT-SAFE half.

   Founder, verbatim: "add import lead button when I click on it it gives me the
   option to download the import template or import the leads actually". Asked,
   he answered: imported leads land UNASSIGNED (no owner — the admin assigns
   them afterwards), and a row whose phone number already exists is SKIPPED AND
   REPORTED, never overwriting the existing lead.

   The inverse of ADR-083's export, built the same way. This file holds what
   BOTH sides of the wire need — the wall, the template's column contract, the
   limits, the shape of a result and the words for every reason — and nothing
   heavier: no zod, no Prisma, no spreadsheet library, so the button can import
   it without dragging a validator into the browser. The rules that READ a row
   (phone, type, date, headers, duplicates) live in ./leads-import-plan.ts.
   ========================================================================== */

/* ---- 1. THE WALL ----------------------------------------------------------

   "Whoever may open that company's Leads page AND create leads there" — two
   existing walls, intersected, and no third one invented.

     · OPEN THE LEADS PAGE — ADR-083 already reduced the page's guard to a
       predicate, `canExportLeads`, and proves it equal to the page for all 64
       role subsets × both companies. Reused here under its meaning, and
       re-proven against the page in leads-import.test.ts.
     · CREATE A LEAD — the two create endpoints' own role lists, transcribed
       below, and held to those endpoints by leads-import.integration.test.ts,
       which calls the REAL create routes for every role.

   What the intersection admits, worked out rather than asserted:
     ByteForce  page = byteforce_staff; create = byteforce_staff
                → byteforce_staff.
     B-Systems  page = bsystems_admin (sales, agents and partners are sent to
                their own board; data entry is carved out entirely, ADR-051);
                create = admin, sales, agent, partner, data entry
                → bsystems_admin, and nobody else.
   So the import's wall equals the export's, and for the right reason: a role
   that cannot open the page cannot be handed a button on it. */

/** WHO may create a lead of each company — the create routes' own lists.
    ByteForce: `internalCrmHandlers("byteforce").createLead` →
    `requireBrandStaff` → `staffRolesForBrand("byteforce")`.
    B-Systems: `POST /api/b-systems/leads` → its `requireRole(...)` list. */
export const LEAD_CREATE_ROLES: Record<CrmCompany, readonly Role[]> = {
  byteforce: ["byteforce_staff"],
  bsystems: [
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
    "bsystems_data_entry",
  ],
};

/** May these roles import a file of leads into THIS company? Both halves, and
    the page half first. */
export function canImportLeads(roles: Role[], company: CrmCompany): boolean {
  /* canExportLeads IS "can open this company's Leads page" — ADR-083's sweep */
  if (!canExportLeads(roles, company)) return false;
  return LEAD_CREATE_ROLES[company].some((r) => roles.includes(r));
}

/** ADR-067's untouched wall: the company is the ROUTE, never a parameter. */
const IMPORT_BASE: Record<CrmCompany, string> = {
  bsystems: "/api/b-systems/leads/import",
  byteforce: "/api/byteforce/leads/import",
};

export function leadsImportHref(company: CrmCompany): string {
  return IMPORT_BASE[company];
}

export function leadsImportTemplateHref(company: CrmCompany): string {
  return `${IMPORT_BASE[company]}/template`;
}

/* ---- 2. THE TEMPLATE'S CONTRACT -------------------------------------------

   The columns are `createLead`'s own inputs, minus the one an import must not
   carry (`salesRepId` — imported leads land unassigned), plus one it may: the
   date the lead was really first had, so importing a year of old leads does not
   make every one of them "new this month" on the dashboard.

   Headers are STABLE ENGLISH whatever the viewer's language, because a machine
   reads them back; the two instructions sheets carry the Arabic. Required
   columns wear a "*" — and the requirement is per company, because B-Systems'
   create rule makes the company name mandatory and ByteForce's does not. */

export const IMPORT_FIELDS = [
  "name",
  "number",
  "type",
  "email",
  "companyName",
  "position",
  "industry",
  "requirements",
  "description",
  "createdAt",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

export const IMPORT_HEADERS: Record<ImportField, string> = {
  name: "Name",
  number: "Number",
  type: "Type",
  email: "Email",
  companyName: "Company",
  position: "Position",
  industry: "Industry",
  requirements: "Requirements",
  description: "Description",
  createdAt: "Created date",
};

/** What a person reads for a field on the result screen — the product's own
    words for each, referenced rather than retyped. */
export const IMPORT_FIELD_LABELS: Record<ImportField, Msg> = {
  name: common.name,
  number: common.number,
  type: common.type,
  email: common.email,
  companyName: common.company,
  position: common.position,
  industry: common.industry,
  requirements: common.requirements,
  description: m.fieldDescription,
  createdAt: m.fieldCreatedDate,
};

export function requiredImportFields(company: CrmCompany): ImportField[] {
  return company === "bsystems"
    ? ["name", "number", "type", "companyName"]
    : ["name", "number", "type"];
}

export function importHeader(field: ImportField, company: CrmCompany): string {
  return IMPORT_HEADERS[field] + (requiredImportFields(company).includes(field) ? "*" : "");
}

/** The header row of THIS company's template, in column order. */
export function importHeaderRow(company: CrmCompany): string[] {
  return IMPORT_FIELDS.map((f) => importHeader(f, company));
}

/** Two report columns the SKIPPED-ROWS file adds after the template's own, so
    that file can be fixed and imported again: recognised, and ignored. */
export const REPORT_HEADERS = { row: "Row", reason: "Skipped because" } as const;

/** The leads sheet's name CARRIES THE COMPANY. The button names its company so
    nobody imports ByteForce's list into B-Systems; the file names it too, so a
    template downloaded on one company's page is refused on the other's. */
export const IMPORT_SHEET: Record<CrmCompany, string> = {
  bsystems: "B-Systems leads",
  byteforce: "ByteForce leads",
};

export function importTemplateFilename(company: CrmCompany): string {
  return `${company === "bsystems" ? "b-systems" : "byteforce"}-leads-import-template.xlsx`;
}

export function skippedRowsFilename(company: CrmCompany, cairoDate: string): string {
  return `${company === "bsystems" ? "b-systems" : "byteforce"}-leads-skipped-${cairoDate}.xlsx`;
}

/** Row 2 of the template. Recognised and SKIPPED (and reported) if left in. */
export const IMPORT_EXAMPLE: Record<ImportField, string> = {
  name: "EXAMPLE — Mona Adel (delete this row)",
  number: "01000000000",
  type: "Cold call",
  email: "mona@example.com",
  companyName: "Example Trading Co.",
  position: "Marketing manager",
  industry: "Retail",
  requirements: "A new website",
  description: "Met at the Cairo ICT expo",
  createdAt: "15/03/2024",
};

/** The created-date floor. A date before it is "obviously wrong" (a typo'd year,
    or a number Excel read as a date) and the row is SKIPPED with a reason —
    never clamped. Nothing in this business predates it. */
export const IMPORT_MIN_CREATED_YEAR = 2000;

/* ---- 3. LIMITS -------------------------------------------------------------

   Refused up front with a sentence, never discovered as a timeout. A thousand
   rows is a whole event list or a purchased database at once and goes in as one
   transaction in a few seconds (measured in the integration suite). Two
   megabytes holds a thousand fully-filled rows several times over. The unzipped
   ceiling is the zip-bomb guard: an .xlsx is a zip, and two megabytes of zip can
   DECLARE far more than that unpacked. */
export const MAX_IMPORT_ROWS = 1000;
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024;
export const MAX_IMPORT_UNZIPPED_BYTES = 40 * 1024 * 1024;
export const MAX_IMPORT_MB = MAX_IMPORT_BYTES / (1024 * 1024);

/* ---- 4. WHAT A ROW CAN BE TOLD -------------------------------------------- */

export type SkipReason =
  | { code: "example" }
  | { code: "missingName" }
  | { code: "missingNumber" }
  | { code: "invalidNumber"; value: string }
  | { code: "numberStoredAsNumber"; value: string }
  | { code: "missingType" }
  | { code: "unknownType"; value: string }
  | { code: "missingCompany" }
  | { code: "invalidEmail"; value: string }
  | { code: "invalidDate"; value: string }
  | { code: "futureDate"; date: string }
  | { code: "tooOldDate"; date: string }
  | { code: "tooLong"; field: ImportField; max: number }
  | { code: "invalidValue"; field: ImportField }
  | { code: "duplicateInSystem"; existingName: string }
  | { code: "duplicateInFile"; firstRow: number };

export interface SkippedRow {
  /** the row number the founder sees in Excel (the header is row 1) */
  row: number;
  /** what was typed, per template column — for the screen and the re-import file */
  values: Record<ImportField, string>;
  reasons: SkipReason[];
}

export interface RestoredNumber {
  row: number;
  from: string;
  to: string;
}

/** What a finished import answers with. */
export interface ImportResultBody {
  company: CrmCompany;
  imported: number;
  skipped: SkippedRow[];
  restored: RestoredNumber[];
  /** the skipped rows as a re-importable .xlsx, base64 — null when none */
  skippedFile: { filename: string; base64: string } | null;
}

/** Why a whole FILE was refused. Nothing is imported in any of these. */
export type ImportFileErrorCode =
  | "no_file"
  | "not_xlsx"
  | "too_large"
  | "too_many_rows"
  | "wrong_template"
  | "wrong_company"
  | "empty"
  | "unreadable"
  | "failed";

export interface ImportFileErrorBody {
  error: string;
  code: ImportFileErrorCode;
  rows?: number;
  missing?: string[];
  unexpected?: string[];
  duplicated?: string[];
  otherCompany?: CrmCompany;
}

/* ---- 5. WORDS -------------------------------------------------------------- */

const companyName = (c: CrmCompany): Msg => acctCompanies[c]!;

const typesList = (): Msg => ({
  en: LEAD_TYPES.map((t) => leadTypeMsgs[t].en).join(", "),
  ar: LEAD_TYPES.map((t) => `${leadTypeMsgs[t].en} (${leadTypeMsgs[t].ar})`).join("، "),
});

/** "2024-03-15" → "15/03/2024": the product's own day-first spelling of a date
    (the export's numFmt), rearranged from the ISO string — no clock involved. */
export function dayFirst(isoDate: string): string {
  const [y, mo, d] = isoDate.split("-");
  return `${d}/${mo}/${y}`;
}

/** One skip reason as a sentence, in both languages. Shared by the result
    screen and the skipped-rows file, so the two can never word a reason
    differently. */
export function skipReasonMsg(reason: SkipReason, company: CrmCompany): Msg {
  switch (reason.code) {
    case "example":
      return m.reasonExample;
    case "missingName":
      return m.reasonMissingName;
    case "missingNumber":
      return m.reasonMissingNumber;
    case "invalidNumber":
      return formatMsg(m.reasonInvalidNumber, { value: reason.value });
    case "numberStoredAsNumber":
      return formatMsg(m.reasonNumberStoredAsNumber, { value: reason.value });
    case "missingType":
      return m.reasonMissingType;
    case "unknownType":
      return formatMsg(m.reasonUnknownType, { value: reason.value, types: typesList() });
    case "missingCompany":
      return m.reasonMissingCompany;
    case "invalidEmail":
      return formatMsg(m.reasonInvalidEmail, { value: reason.value });
    case "invalidDate":
      return formatMsg(m.reasonInvalidDate, { value: reason.value });
    case "futureDate":
      return formatMsg(m.reasonFutureDate, { date: dayFirst(reason.date) });
    case "tooOldDate":
      return formatMsg(m.reasonTooOldDate, {
        date: dayFirst(reason.date),
        year: String(IMPORT_MIN_CREATED_YEAR),
      });
    case "tooLong":
      return formatMsg(m.reasonTooLong, {
        field: IMPORT_FIELD_LABELS[reason.field],
        max: String(reason.max),
      });
    case "invalidValue":
      return formatMsg(m.reasonInvalidValue, { field: IMPORT_FIELD_LABELS[reason.field] });
    case "duplicateInSystem":
      return formatMsg(m.reasonDuplicateInSystem, {
        company: companyName(company),
        name: reason.existingName,
      });
    case "duplicateInFile":
      return formatMsg(m.reasonDuplicateInFile, { row: String(reason.firstRow) });
  }
}

/** Every reason of a row, joined — one line per skipped row. */
export function skipReasonsMsg(reasons: SkipReason[], company: CrmCompany): Msg {
  const parts = reasons.map((r) => skipReasonMsg(r, company));
  return { en: parts.map((p) => p.en).join("; "), ar: parts.map((p) => p.ar).join("؛ ") };
}

/** A refused file, as sentences in both languages (the screen picks one). */
export function fileErrorMsgs(body: ImportFileErrorBody, company: CrmCompany): Msg[] {
  switch (body.code) {
    case "no_file":
      return [m.errorNoFile];
    case "not_xlsx":
      return [m.errorNotXlsx];
    case "too_large":
      return [formatMsg(m.errorTooLarge, { mb: String(MAX_IMPORT_MB) })];
    case "too_many_rows":
      return [
        formatMsg(m.errorTooManyRows, {
          n: String(body.rows ?? ""),
          max: String(MAX_IMPORT_ROWS),
        }),
      ];
    case "wrong_template": {
      const out: Msg[] = [m.errorWrongTemplate];
      if (body.missing?.length) {
        out.push(formatMsg(m.errorMissingColumns, { list: body.missing.join(", ") }));
      }
      if (body.unexpected?.length) {
        out.push(formatMsg(m.errorUnexpectedColumns, { list: body.unexpected.join(", ") }));
      }
      if (body.duplicated?.length) {
        out.push(formatMsg(m.errorDuplicatedColumns, { list: body.duplicated.join(", ") }));
      }
      return out;
    }
    case "wrong_company": {
      const other = body.otherCompany ?? (company === "bsystems" ? "byteforce" : "bsystems");
      return [
        formatMsg(m.errorWrongCompany, { other: companyName(other), company: companyName(company) }),
      ];
    }
    case "empty":
      return [m.errorEmpty];
    case "unreadable":
      return [m.errorUnreadable];
    case "failed":
      return [m.errorFailed];
  }
}
