import { LEAD_TYPES, type LeadType } from "@/lib/pipeline-engine/constants";
import { leadTypeMsgs } from "@/lib/i18n/dict/labels";
import { isValidPhone, normalizePhone } from "@/lib/auth/phone";
import { telDigits, waDigits } from "@/lib/phone-dial";
import { startOfCairoDay, utcToCairo } from "@/lib/datetime";
import type { CrmCompany } from "./company";
import { createLeadSchemaFor, type CreateLeadInput } from "./lead-create-schema";
import {
  IMPORT_EXAMPLE,
  IMPORT_FIELDS,
  IMPORT_HEADERS,
  IMPORT_MIN_CREATED_YEAR,
  REPORT_HEADERS,
  importHeader,
  requiredImportFields,
  type ImportField,
  type RestoredNumber,
  type SkipReason,
  type SkippedRow,
} from "./leads-import";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the rules that READ a row. Pure (no Prisma, no
   spreadsheet library), server-side and in the tests.

   Every rule here is one the product already has, applied to a cell:
     · a phone is normalised by the house normaliser (lib/auth/phone.ts) and
       compared by the product's own country-code rule (lib/phone-dial.ts);
     · a lead is valid when the create schema the Add-lead form is held to says
       so (lib/crm/lead-create-schema.ts) — no second copy of a length limit;
     · a date is a CAIRO calendar day turned into an instant by
       lib/datetime.ts's `startOfCairoDay`, the same helper the To-Do and the
       daily report use, DST clamp included.
   ========================================================================== */

/* ---- CELLS ----------------------------------------------------------------- */

/** A NUMERIC cell, as Excel stored it. The reader hands every numeric cell over
    as this marker (with Excel's own digits) instead of a JS number, so the
    importer can tell "the person typed text" from "Excel turned it into a
    number" — the difference that decides whether a leading 0 was lost. */
export class SpreadsheetNumber {
  constructor(readonly raw: string) {}
}

export type ImportCell = string | number | boolean | Date | SpreadsheetNumber | null | undefined;

/** Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII. An Arabic
    keyboard types these, and the house normaliser does not fold them — the
    landing intake had to add the same fold for the same reason. */
export function foldDigits(value: string): string {
  let out = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 0x0660 && code <= 0x0669) out += String(code - 0x0660);
    else if (code >= 0x06f0 && code <= 0x06f9) out += String(code - 0x06f0);
    else out += char;
  }
  return out;
}

/** A Date cell's CALENDAR DAY. read-excel-file hands a date cell back as the
    wall clock Excel showed, pinned to UTC (measured: a cell showing 15/03/2024
    23:30 reads as 2024-03-15T23:30Z) — the very convention ADR-083's export
    WRITES with — so the day is the UTC date part, never a zone conversion,
    which would move a late-evening cell onto the next day. */
function dateCellDay(cell: Date): string | null {
  return Number.isNaN(cell.getTime()) ? null : cell.toISOString().slice(0, 10);
}

/** A cell as the text a person would read in it ("" when empty). */
export function cellText(cell: ImportCell): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof SpreadsheetNumber) return cell.raw.trim();
  if (cell instanceof Date) {
    const day = dateCellDay(cell);
    return day ? day.split("-").reverse().join("/") : "";
  }
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell).trim();
}

/* ---- THE PHONE RULE ---------------------------------------------------------

   NORMALISED THE WAY THE PRODUCT ALREADY NORMALISES A PHONE: `normalizePhone`
   (strip spaces, dashes, dots and brackets; 00 → +) and `isValidPhone` (an
   optional + and 7–15 digits) — the pair the portal login, account creation and
   the landing intake use. Plus the Arabic-digit fold above.

   THE LEADING-ZERO RULE. Every Egyptian mobile is 01[0|1|2|5] + 8 digits, and
   Excel stores 01012345678 typed into a General cell as the NUMBER 1012345678.
   So:

     · a 10-digit 1[0125]XXXXXXXX gets its 0 back. No number in Egypt's
       national format — or any other format the team dials — is ten digits
       starting with 1, so this is a repair with exactly one answer;
     · a 12-digit 201[0125]XXXXXXXX that arrived as a NUMBER gets its "+" back
       (Excel reads "+201012345678" as a positive number and drops the sign);
     · ANY OTHER cell Excel stored as a number is REFUSED, with a reason that
       says how to fix it. A Cairo landline 0221000001 arrives as 221000001, and
       whether that was 0221000001 or a nine-digit foreign number cannot be
       known — so no digit is invented beyond the two shapes above.

   The 10-digit repair applies to a TEXT cell too, because the digits mean the
   same thing whoever dropped the zero (pasting values from a sheet that had
   already lost it lands as text). Every repair is reported back, by row. */

const EG_MOBILE_WITHOUT_ZERO = /^1[0125]\d{8}$/;
const EG_MOBILE_INTL_WITHOUT_PLUS = /^201[0125]\d{8}$/;

export type NumberReading =
  | { ok: true; number: string; restored: { from: string } | null }
  | { ok: false; reason: "missingNumber" | "invalidNumber" | "numberStoredAsNumber"; value: string };

export function readImportNumber(cell: ImportCell): NumberReading {
  if (cell instanceof SpreadsheetNumber || typeof cell === "number") {
    const raw = cell instanceof SpreadsheetNumber ? cell.raw.trim() : String(cell);
    const n = Number(raw);
    /* an integer JS holds exactly — every real phone number is one */
    if (!raw || !Number.isSafeInteger(n) || n <= 0) {
      return { ok: false, reason: "invalidNumber", value: raw };
    }
    const digits = String(n);
    if (EG_MOBILE_WITHOUT_ZERO.test(digits)) {
      return { ok: true, number: `0${digits}`, restored: { from: digits } };
    }
    if (EG_MOBILE_INTL_WITHOUT_PLUS.test(digits)) {
      return { ok: true, number: `+${digits}`, restored: { from: digits } };
    }
    return { ok: false, reason: "numberStoredAsNumber", value: digits };
  }
  if (cell instanceof Date || typeof cell === "boolean") {
    return { ok: false, reason: "invalidNumber", value: cellText(cell) };
  }
  /* a text cell. A leading apostrophe is how people force text in Excel; in a
     cell that is ALREADY text it is stored literally, so it is dropped here. */
  const typed = foldDigits(cellText(cell)).replace(/^'+/, "").trim();
  if (!typed) return { ok: false, reason: "missingNumber", value: "" };
  let number = normalizePhone(typed);
  let restored: { from: string } | null = null;
  if (EG_MOBILE_WITHOUT_ZERO.test(number)) {
    restored = { from: number };
    number = `0${number}`;
  }
  if (!isValidPhone(number)) return { ok: false, reason: "invalidNumber", value: cellText(cell) };
  return { ok: true, number, restored };
}

/** THE DUPLICATE KEY — when are two numbers the same line?

    Lead numbers in this table are free text, typed every way a person types a
    number ("010 1234 5678", "+20 101 234 5678", "01012345678"). So both sides
    of the comparison go through the house normaliser and then the product's
    OWN rule for "which country-coded number is this" — `waDigits`, which
    already treats a local 01… mobile and its +20 form as one WhatsApp number.
    Every spelling of one Egyptian mobile therefore meets at one key. Anything
    waDigits declines (a 0-leading landline, whose country it will not guess)
    is compared by its plain digits: a landline matches itself exactly and is
    never matched by a guess. */
export function phoneKey(raw: string): string {
  let p = normalizePhone(foldDigits(raw).replace(/^'+/, "").trim());
  if (EG_MOBILE_WITHOUT_ZERO.test(p)) p = `0${p}`;
  return waDigits(p) ?? telDigits(p);
}

/* ---- THE TYPE ---------------------------------------------------------------- */

const typeKey = (s: string) =>
  s.normalize("NFKC").trim().toLowerCase().replace(/[\s_\-]+/g, " ");

/* the stored key ("cold_call"), the English label the template's dropdown
   offers ("Cold call") and the Arabic label ("اتصال مباشر") all read */
const TYPE_LOOKUP = new Map<string, LeadType>();
for (const t of LEAD_TYPES) {
  TYPE_LOOKUP.set(typeKey(t), t);
  TYPE_LOOKUP.set(typeKey(leadTypeMsgs[t].en), t);
  TYPE_LOOKUP.set(typeKey(leadTypeMsgs[t].ar), t);
}

export function readImportType(cell: ImportCell): LeadType | "missing" | null {
  const text = cellText(cell);
  if (!text) return "missing";
  return TYPE_LOOKUP.get(typeKey(text)) ?? null;
}

/** The values the template's dropdown offers — the English labels, in order. */
export function importTypeChoices(): string[] {
  return LEAD_TYPES.map((t) => leadTypeMsgs[t].en);
}

/* ---- THE CREATED DATE ---------------------------------------------------------

   OPTIONAL. Blank = the lead is dated the moment of the import, as every lead
   always has been. Present = the lead keeps its real age: a CAIRO calendar day,
   stored as that day's first instant through `startOfCairoDay` (store UTC,
   interpret the day in Africa/Cairo — SPEC §2), so the dashboard counts it in
   the month it really arrived instead of spiking on import day.

   What read-excel-file actually hands over, each handled and each tested:
     · a Date — a cell Excel itself treated as a date (pasted from another
       sheet, or retyped in a date-formatted column). Its day is the UTC date
       part (see `dateCellDay`).
     · a numeric serial — a date sitting in a General/Number cell (45366).
       Excel's 1900 system: day 0 is 30/12/1899, and `Date.UTC`'s own day
       rollover turns the count into a calendar day — the same calendar
       arithmetic datetime.ts uses, never a fixed number of milliseconds.
     · text — what the template's Text-formatted column receives. The template
       says DD/MM/YYYY, so DD/MM/YYYY is read day-first, and the unambiguous
       YYYY-MM-DD is read too. Nothing else is guessed: "03/15/2024" (US order)
       is refused, not flipped. The column is Text precisely so Excel never
       gets to swap a day and a month on the way in.

   REFUSED, never clamped: a day that does not exist (31/02), a day in the
   future, and a day before 01/01/2000. */

const ISO_DAY = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const DAY_FIRST = /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{4})$/;
const pad2 = (n: string | number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" when that calendar day exists, else null. The existence check
    is a round trip through datetime.ts: `startOfCairoDay` of 31/02 rolls into
    March, and the Cairo date that comes back no longer matches. */
function realDay(y: string | number, mo: string | number, d: string | number): string | null {
  const iso = `${y}-${pad2(mo)}-${pad2(d)}`;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || Number(mo) < 1 || Number(d) < 1) return null;
  try {
    return utcToCairo(startOfCairoDay(iso)).date === iso ? iso : null;
  } catch {
    return null;
  }
}

/** Excel's 1900 date system: serial 1 is 01/01/1900 and, because of Lotus's
    phantom 29/02/1900, every serial from 61 on counts from 30/12/1899. Only
    serials ≥ 61 are dates this importer can accept anyway (the floor is 2000). */
function serialDay(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 61) return null;
  const day = new Date(Date.UTC(1899, 11, 30 + Math.floor(serial)));
  return `${day.getUTCFullYear()}-${pad2(day.getUTCMonth() + 1)}-${pad2(day.getUTCDate())}`;
}

export type CreatedDateReading =
  | { ok: true; day: string | null; at: Date | null }
  | { ok: false; reason: SkipReason };

export function readImportCreatedDate(cell: ImportCell, now: Date): CreatedDateReading {
  const shown = cellText(cell);
  if (!shown) return { ok: true, day: null, at: null };
  let day: string | null = null;
  if (cell instanceof Date) {
    day = dateCellDay(cell);
  } else if (cell instanceof SpreadsheetNumber || typeof cell === "number") {
    day = serialDay(Number(cell instanceof SpreadsheetNumber ? cell.raw : cell));
  } else if (typeof cell === "string") {
    const text = foldDigits(shown).replace(/^'+/, "").trim();
    const iso = ISO_DAY.exec(text);
    const dmy = DAY_FIRST.exec(text);
    if (iso) day = realDay(iso[1]!, iso[2]!, iso[3]!);
    else if (dmy) day = realDay(dmy[3]!, dmy[2]!, dmy[1]!);
  }
  if (!day) return { ok: false, reason: { code: "invalidDate", value: shown } };
  if (day < `${IMPORT_MIN_CREATED_YEAR}-01-01`) {
    return { ok: false, reason: { code: "tooOldDate", date: day } };
  }
  if (day > utcToCairo(now).date) return { ok: false, reason: { code: "futureDate", date: day } };
  return { ok: true, day, at: startOfCairoDay(day) };
}

/* ---- THE HEADER ROW -----------------------------------------------------------

   A file is "this template" when its header row names every REQUIRED column of
   this company and nothing the template does not have. Order does not matter
   (columns are found by name) and an optional column may be deleted. A file
   that fails is refused WHOLE, naming the columns — importing a sheet whose
   columns mean something else would be importing garbage. */

const headerKey = (s: string) =>
  s.trim().replace(/\*+$/, "").trim().replace(/\s+/g, " ").toLowerCase();

const HEADER_LOOKUP = new Map<string, ImportField>(
  IMPORT_FIELDS.map((f) => [headerKey(IMPORT_HEADERS[f]), f]),
);
const IGNORED_HEADERS = new Set(Object.values(REPORT_HEADERS).map(headerKey));

export type HeaderMatch =
  | { ok: true; columns: Partial<Record<ImportField, number>> }
  | { ok: false; missing: string[]; unexpected: string[]; duplicated: string[] };

export function matchImportHeaders(headerRow: ImportCell[], company: CrmCompany): HeaderMatch {
  const columns: Partial<Record<ImportField, number>> = {};
  const unexpected: string[] = [];
  const duplicated: string[] = [];
  headerRow.forEach((cell, index) => {
    const text = cellText(cell);
    if (!text) return;
    const key = headerKey(text);
    if (IGNORED_HEADERS.has(key)) return;
    const field = HEADER_LOOKUP.get(key);
    if (!field) {
      unexpected.push(text);
      return;
    }
    if (columns[field] !== undefined) {
      duplicated.push(text);
      return;
    }
    columns[field] = index;
  });
  const missing = requiredImportFields(company)
    .filter((f) => columns[f] === undefined)
    .map((f) => importHeader(f, company));
  if (missing.length || unexpected.length || duplicated.length) {
    return { ok: false, missing, unexpected, duplicated };
  }
  return { ok: true, columns };
}

/* ---- ROWS -------------------------------------------------------------------- */

/** One spreadsheet row, cut to the template's fields. `row` is the ROW NUMBER
    the founder sees in Excel (the header is row 1). */
export interface ImportRow {
  row: number;
  cells: Partial<Record<ImportField, ImportCell>>;
}

export function rowsFromSheet(
  data: ImportCell[][],
  columns: Partial<Record<ImportField, number>>,
): ImportRow[] {
  const out: ImportRow[] = [];
  for (let i = 1; i < data.length; i++) {
    const line = data[i] ?? [];
    const cells: Partial<Record<ImportField, ImportCell>> = {};
    for (const f of IMPORT_FIELDS) {
      const at = columns[f];
      if (at !== undefined) cells[f] = line[at] ?? null;
    }
    out.push({ row: i + 1, cells });
  }
  return out;
}

export function isBlankRow(row: ImportRow): boolean {
  return IMPORT_FIELDS.every((f) => cellText(row.cells[f]) === "");
}

/** The template's own example row, left in. Either of its two identifying
    cells is enough: 01000000000 is no real subscriber, and the name says
    "delete this row" in as many words. */
export function isExampleRow(row: ImportRow): boolean {
  if (cellText(row.cells.name) === IMPORT_EXAMPLE.name) return true;
  const n = readImportNumber(row.cells.number);
  return n.ok && n.number === IMPORT_EXAMPLE.number;
}

/** How many rows count against MAX_IMPORT_ROWS: every non-blank row except an
    untouched example. */
export function countDataRows(rows: ImportRow[]): number {
  return rows.filter((r) => !isBlankRow(r) && !isExampleRow(r)).length;
}

export interface PlannedLead {
  row: number;
  input: CreateLeadInput;
  /** the lead's real first day, or null = "now" */
  createdAt: Date | null;
}

export interface ImportPlan {
  planned: PlannedLead[];
  skipped: SkippedRow[];
  restored: RestoredNumber[];
}

/** An existing lead of THIS company, as the duplicate check needs it. */
export interface ExistingNumber {
  number: string;
  name: string;
}

const optional = (s: string): string | undefined => (s === "" ? undefined : s);
const sameReason = (a: SkipReason, b: SkipReason) => JSON.stringify(a) === JSON.stringify(b);

/** Validate every row and decide, for each, "create" or "skip — because".

    Pure: the existing numbers are handed in (the service reads them INSIDE the
    import's transaction) and `now` is injectable, so a test names the day.

    ORDER: the row's own validity first — ALL its problems at once, so one pass
    in Excel fixes them — then "already in the system", then "already earlier
    in this file". The in-file check remembers only rows that WILL be imported:
    when row 2 is invalid and row 9 repeats its number, row 9 is the first good
    copy and goes in. Nothing existing is ever updated or merged. */
export function planImport(
  rows: ImportRow[],
  company: CrmCompany,
  existing: ExistingNumber[],
  now: Date = new Date(),
): ImportPlan {
  const schema = createLeadSchemaFor(company);
  const inSystem = new Map<string, string>();
  for (const e of existing) {
    const key = phoneKey(e.number);
    /* a junk stored number ("N/A") has no digits — it must not match anything */
    if (key && !inSystem.has(key)) inSystem.set(key, e.name);
  }
  const firstRowByKey = new Map<string, number>();
  const plan: ImportPlan = { planned: [], skipped: [], restored: [] };

  for (const row of rows) {
    if (isBlankRow(row)) continue;
    const values = Object.fromEntries(
      IMPORT_FIELDS.map((f) => [f, cellText(row.cells[f])]),
    ) as Record<ImportField, string>;
    const skip = (reasons: SkipReason[]) => plan.skipped.push({ row: row.row, values, reasons });

    if (isExampleRow(row)) {
      skip([{ code: "example" }]);
      continue;
    }

    const reasons: SkipReason[] = [];
    const add = (r: SkipReason) => {
      if (!reasons.some((x) => sameReason(x, r))) reasons.push(r);
    };
    if (!values.name) add({ code: "missingName" });
    const number = readImportNumber(row.cells.number);
    if (!number.ok) {
      add(
        number.reason === "missingNumber"
          ? { code: "missingNumber" }
          : { code: number.reason, value: number.value },
      );
    }
    const type = readImportType(row.cells.type);
    if (type === "missing") add({ code: "missingType" });
    else if (type === null) add({ code: "unknownType", value: values.type });

    const parsed = schema.safeParse({
      name: values.name,
      number: number.ok ? number.number : values.number,
      type: type && type !== "missing" ? type : values.type,
      email: optional(values.email),
      companyName: optional(values.companyName),
      position: optional(values.position),
      industry: optional(values.industry),
      requirements: optional(values.requirements),
      description: optional(values.description),
    });
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as ImportField | undefined;
        if (!field || !(IMPORT_FIELDS as readonly string[]).includes(field)) continue;
        /* already said above, in the founder's own terms */
        if (field === "name" && !values.name) continue;
        if (field === "number" && !number.ok) continue;
        if (field === "type") continue;
        if (issue.code === "too_big") {
          add({ code: "tooLong", field, max: Number((issue as { maximum?: unknown }).maximum) });
        } else if (field === "companyName" && !values.companyName) {
          add({ code: "missingCompany" });
        } else if (field === "email") {
          add({ code: "invalidEmail", value: values.email });
        } else {
          add({ code: "invalidValue", field });
        }
      }
    }
    const created = readImportCreatedDate(row.cells.createdAt, now);
    if (!created.ok) add(created.reason);

    if (reasons.length || !parsed.success || !number.ok || !created.ok) {
      skip(reasons.length ? reasons : [{ code: "invalidValue", field: "name" }]);
      continue;
    }

    const key = phoneKey(number.number);
    const existingName = inSystem.get(key);
    if (existingName !== undefined) {
      skip([{ code: "duplicateInSystem", existingName }]);
      continue;
    }
    const firstRow = firstRowByKey.get(key);
    if (firstRow !== undefined) {
      skip([{ code: "duplicateInFile", firstRow }]);
      continue;
    }
    firstRowByKey.set(key, row.row);
    /* the PARSED value, so the create path receives exactly what the schema
       accepted (the email's "" → undefined transform included) */
    plan.planned.push({ row: row.row, input: parsed.data as CreateLeadInput, createdAt: created.at });
    if (number.restored) {
      plan.restored.push({ row: row.row, from: number.restored.from, to: number.number });
    }
  }
  return plan;
}
