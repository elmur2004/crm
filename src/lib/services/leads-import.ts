import writeXlsxFile from "write-excel-file/node";
import {
  getOrderOfSiblings,
  insertElementMarkupAccordingToOrderOfSiblings,
  sanitizeAttributeValue,
  sanitizeTextContent,
} from "write-excel-file/utility";
import readExcelFile from "read-excel-file/node";
import { db } from "@/lib/db";
import { utcToCairo } from "@/lib/datetime";
import { formatMsg, tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { leadsExport } from "@/lib/i18n/dict/crm";
import { leadTypeMsgs } from "@/lib/i18n/dict/labels";
import { leadsImport as m } from "@/lib/i18n/dict/leads-import";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import type { CrmCompany } from "@/lib/crm/company";
import {
  IMPORT_EXAMPLE,
  IMPORT_FIELDS,
  IMPORT_MIN_CREATED_YEAR,
  IMPORT_SHEET,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_MB,
  MAX_IMPORT_ROWS,
  MAX_IMPORT_UNZIPPED_BYTES,
  REPORT_HEADERS,
  importHeader,
  importHeaderRow,
  importTemplateFilename,
  requiredImportFields,
  fileErrorMsgs,
  skipReasonsMsg,
  skippedRowsFilename,
  type ImportFileErrorBody,
  type ImportFileErrorCode,
  type ImportResultBody,
  type ImportField,
  type SkippedRow,
} from "@/lib/crm/leads-import";
import {
  SpreadsheetNumber,
  countDataRows,
  importTypeChoices,
  matchImportHeaders,
  planImport,
  rowsFromSheet,
  type ImportCell,
  type ImportRow,
} from "@/lib/crm/leads-import-plan";
import { createLead } from "./leads";
import { invalidateUndo } from "./undo";
import type { Actor } from "./activity";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the half that touches the database and the file.

   THE TEMPLATE is written with `write-excel-file` (ADR-083's library, already a
   runtime dependency). THE UPLOAD is read with `read-excel-file`, which until
   now was a dev dependency used only to read the export back in tests — it is
   a runtime dependency now (reported for an ADR). Neither reaches a browser:
   this module is imported by the two import routes and nothing else.

   ATOMICITY — ONE TRANSACTION FOR THE WHOLE FILE, decided rather than
   defaulted:

     · every row is validated BEFORE anything is written, so a row the founder
       has to fix is a SKIP with a reason, never a failure part-way;
     · what is left to fail is the unexpected (the database going away, a
       deploy restarting the process). Row-by-row, that would leave "rows 2–340
       are in, 341 onwards are not" with the result screen never arriving — the
       one outcome where he cannot know what was imported. All-or-nothing turns
       every such failure into "nothing was imported", which is both true and
       safe to retry;
     · and a retry is SAFE in either case, because the duplicate rule skips
       whatever is already in — so the transaction is not even the only
       protection, it is the one that makes the screen's sentence honest.

   The transaction also takes a per-company advisory lock and reads the
   existing numbers INSIDE it, so two imports of the same file pressed at once
   (two tabs, a double submit) are serialised and the second one sees the
   first one's leads as duplicates instead of creating them twice.
   ========================================================================== */

/* ---- the refusal, as a value ------------------------------------------------ */

/** A whole file refused before anything was written. The route answers it as
    JSON with a CODE the screen words in either language. */
export class ImportFileError extends Error {
  constructor(
    readonly status: number,
    readonly body: ImportFileErrorBody,
  ) {
    super(body.error);
    this.name = "ImportFileError";
  }
}

/** A refusal for THIS company. Its English `error` is built from the same
    sentences the screen shows (`fileErrorMsgs`), so an API caller and the
    founder read the same words. */
export function fileError(
  company: CrmCompany,
  status: number,
  code: ImportFileErrorCode,
  extra: Omit<ImportFileErrorBody, "error" | "code"> = {},
): ImportFileError {
  const body = { error: "", code, ...extra };
  body.error = fileErrorMsgs(body, company)
    .map((msg) => msg.en)
    .join(" ");
  return new ImportFileError(status, body);
}

/* ---- the zip, before anybody unpacks it ------------------------------------- */

/** The total UNCOMPRESSED size a zip DECLARES, read from its central directory
    without inflating a byte — or null when this is not a readable zip.

    The zip-bomb guard. read-excel-file unpacks every entry into memory, and two
    megabytes of deflate can declare gigabytes; the ceiling is checked here
    first. (A file that LIES in its central directory is bounded by the 2 MB
    upload cap and by an endpoint only an admin can reach.) */
export function zipDeclaredSize(buf: Buffer): number | null {
  const EOCD = 0x06054b50;
  const CEN = 0x02014b50;
  const from = Math.max(0, buf.length - (22 + 0xffff));
  let eocd = -1;
  for (let i = buf.length - 22; i >= from; i--) {
    if (buf.readUInt32LE(i) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) return null;
  const entries = buf.readUInt16LE(eocd + 10);
  let at = buf.readUInt32LE(eocd + 16);
  let total = 0;
  for (let n = 0; n < entries; n++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== CEN) return null;
    const size = buf.readUInt32LE(at + 24);
    /* ZIP64 marker: a size this file format cannot state honestly at 2 MB */
    if (size === 0xffffffff) return Number.POSITIVE_INFINITY;
    total += size;
    at += 46 + buf.readUInt16LE(at + 28) + buf.readUInt16LE(at + 30) + buf.readUInt16LE(at + 32);
  }
  return total;
}

/* ---- READING the upload ---------------------------------------------------- */

const OTHER: Record<CrmCompany, CrmCompany> = { bsystems: "byteforce", byteforce: "bsystems" };
const sameSheet = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The upload → the rows of THIS company's leads sheet, or an ImportFileError
    naming exactly why not. Nothing here touches the database. */
export async function readImportWorkbook(buffer: Buffer, company: CrmCompany): Promise<ImportRow[]> {
  if (buffer.length > MAX_IMPORT_BYTES) throw fileError(company, 413, "too_large");
  if (buffer.length === 0) throw fileError(company, 400, "no_file");
  /* every .xlsx is a zip, and every zip starts "PK\3\4". A legacy .xls (OLE2,
     D0 CF 11 E0), a CSV renamed to .xlsx, a PDF — all stop here. */
  if (buffer.length < 4 || buffer.readUInt32LE(0) !== 0x04034b50) throw fileError(company, 400, "not_xlsx");
  const declared = zipDeclaredSize(buffer);
  if (declared === null) throw fileError(company, 400, "unreadable");
  if (declared > MAX_IMPORT_UNZIPPED_BYTES) throw fileError(company, 413, "too_large");

  let sheets: Array<{ sheet: string; data: unknown[][] }>;
  try {
    /* every NUMERIC cell arrives as a SpreadsheetNumber carrying Excel's own
       digits, so a phone Excel turned into a number is told apart from one
       somebody typed (see the leading-zero rule in leads-import-plan.ts) */
    sheets = (await readExcelFile(buffer, {
      parseNumber: (raw: string) => new SpreadsheetNumber(raw),
    })) as Array<{ sheet: string; data: unknown[][] }>;
  } catch (err) {
    const code = (err as { code?: string }).code;
    throw fileError(company, 400, code === "XLS_FILE_NOT_SUPPORTED" || code === "FILE_NOT_SUPPORTED" ? "not_xlsx" : "unreadable");
  }
  if (!sheets.length) throw fileError(company, 400, "empty");

  /* THE COMPANY IS IN THE FILE. This company's sheet wins; the OTHER
     company's sheet alone means the founder is on the wrong page with the
     wrong file — refused, naming both. A file with neither (a sheet he made
     himself) is read from its first tab and must still pass the header check. */
  const own = sheets.find((s) => sameSheet(s.sheet, IMPORT_SHEET[company]));
  const other = sheets.find((s) => sameSheet(s.sheet, IMPORT_SHEET[OTHER[company]]));
  if (!own && other) throw fileError(company, 400, "wrong_company", { otherCompany: OTHER[company] });
  const data = (own ?? sheets[0]!).data as ImportCell[][];

  const match = matchImportHeaders(data[0] ?? [], company);
  if (!match.ok) {
    throw fileError(company, 400, "wrong_template", {
      missing: match.missing,
      unexpected: match.unexpected,
      duplicated: match.duplicated,
    });
  }
  const rows = rowsFromSheet(data, match.columns);
  const count = countDataRows(rows);
  if (count > MAX_IMPORT_ROWS) throw fileError(company, 413, "too_many_rows", { rows: count });
  if (count === 0) throw fileError(company, 400, "empty");
  return rows;
}

/* ---- THE IMPORT ----------------------------------------------------------- */

/** Long enough for a thousand rows on a slow managed database (two statements
    a row), short enough that a wedged connection cannot hold the company's
    import lock for ever. Measured locally in the integration suite. */
const IMPORT_TX = { timeout: 120_000, maxWait: 15_000 } as const;

export async function importLeads(
  company: CrmCompany,
  buffer: Buffer,
  actor: Actor,
  opts: { locale?: Locale; now?: Date } = {},
): Promise<ImportResultBody> {
  const rows = await readImportWorkbook(buffer, company);
  const now = opts.now ?? new Date();

  let plan: ReturnType<typeof planImport>;
  try {
    plan = await db.$transaction(async (tx) => {
      /* one import per company at a time — see the header */
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`leads_import:${company}`}))`;
      /* EVERY lead of the company — archived, won and lost included: "a number
         already in the system" does not stop meaning that because the lead was
         filed away. Oldest first, so a duplicate is reported against the lead
         that has had the number longest. */
      const existing = await tx.lead.findMany({
        where: { brand: company },
        select: { number: true, name: true },
        orderBy: { createdAt: "asc" },
      });
      const decided = planImport(rows, company, existing, now);
      if (decided.planned.length > 0) {
        /* an import is not undoable as a whole, so the one-step Undo must not
           go on offering whatever the founder did BEFORE it (ADR-045) */
        await invalidateUndo(tx, actor);
      }
      for (const lead of decided.planned) {
        /* THROUGH createLead — the one create path — inside this transaction.
           UNASSIGNED, the ADR-051 way: the internal bucket, no owner account,
           no sales rep. createdByUserId is the importer (createLead stamps it
           on every path). The ActivityLog row says "leads_import". */
        await createLead(
          company,
          { ...lead.input, salesRepId: undefined },
          actor,
          {
            tx,
            ownerType: "internal",
            trigger: "leads_import",
            undoable: false,
            ...(lead.createdAt ? { createdAt: lead.createdAt } : {}),
          },
        );
      }
      return decided;
    }, IMPORT_TX);
  } catch (err) {
    console.error("leads import failed — rolled back, nothing written", err);
    throw fileError(company, 500, "failed");
  }

  const skippedFile =
    plan.skipped.length > 0
      ? {
          filename: skippedRowsFilename(company, utcToCairo(now).date),
          base64: (await buildSkippedWorkbook(company, plan.skipped, opts.locale ?? "en")).toString(
            "base64",
          ),
        }
      : null;

  return {
    company,
    imported: plan.planned.length,
    skipped: plan.skipped,
    restored: plan.restored,
    skippedFile,
  };
}

/* ---- WRITING: the template ------------------------------------------------- */

const TEXT = "@";
type Cell = Record<string, unknown> | null;

/** Header + example + the rows a thousand leads can be typed into. */
const TEMPLATE_ROWS = MAX_IMPORT_ROWS + 2;

const COLUMN_WIDTHS: Record<ImportField, number> = {
  name: 28,
  number: 18,
  type: 20,
  email: 28,
  companyName: 26,
  position: 22,
  industry: 18,
  requirements: 34,
  description: 34,
  createdAt: 14,
};

/** A list dropdown on one column of the FIRST sheet — Excel's own data
    validation, which write-excel-file leaves to "features". Written as the
    library's documented feature hook, inserted at the position the sheet's
    schema demands (a misplaced element is a "repair this file?" prompt). */
function listDropdown(opts: { sqref: string; values: string[]; title: string; message: string }) {
  const formula = `"${opts.values.join(",")}"`;
  const markup =
    `<dataValidations count="1"><dataValidation type="list" allowBlank="1" ` +
    `showInputMessage="1" showErrorMessage="1" errorStyle="stop" ` +
    `errorTitle="${sanitizeAttributeValue(opts.title)}" error="${sanitizeAttributeValue(opts.message)}" ` +
    `sqref="${opts.sqref}"><formula1>${sanitizeTextContent(formula)}</formula1></dataValidation></dataValidations>`;
  return {
    files: {
      transform: {
        "xl/worksheets/sheet{id}.xml": {
          transform(xml: string, _sheet: unknown, properties: { sheetIndex: number }) {
            if (properties.sheetIndex !== 0) return xml;
            return insertElementMarkupAccordingToOrderOfSiblings(
              xml,
              markup,
              getOrderOfSiblings("xl/worksheets/sheet{id}.xml", "worksheet") ?? [],
              "worksheet",
            );
          },
        },
      },
    },
  };
}

const columnLetter = (index: number) => String.fromCharCode(65 + index);

/** The two languages' instructions, as rows for one sheet. */
function instructionRows(company: CrmCompany, locale: Locale): Cell[][] {
  const t = tFor(locale);
  const companyMsg = acctCompanies[company]!;
  const types: Msg = {
    en: LEAD_TYPES.map((x) => leadTypeMsgs[x].en).join(", "),
    ar: LEAD_TYPES.map((x) => `${leadTypeMsgs[x].en} (${leadTypeMsgs[x].ar})`).join("، "),
  };
  const required = requiredImportFields(company).map((f) => importHeader(f, company)).join(", ");
  const yes = leadsExport.yes;
  const no = leadsExport.no;
  const what: Record<ImportField, Msg> = {
    name: m.insWhatName,
    number: m.insWhatNumber,
    type: formatMsg(m.insWhatType, { types }),
    email: m.insWhatEmail,
    companyName: m.insWhatCompany,
    position: m.insWhatPosition,
    industry: m.insWhatIndustry,
    requirements: m.insWhatRequirements,
    description: m.insWhatDescription,
    createdAt: m.insWhatCreatedDate,
  };
  const paragraphs: Msg[] = [
    formatMsg(m.insRows, { sheet: IMPORT_SHEET[company] }),
    formatMsg(m.insRequired, { list: required }),
    m.insNumber,
    m.insNumberRule,
    formatMsg(m.insType, { types }),
    formatMsg(m.insCreatedDate, { year: String(IMPORT_MIN_CREATED_YEAR) }),
    formatMsg(m.insDuplicates, { company: companyMsg }),
    m.insUnassigned,
    m.insExample,
    formatMsg(m.insLimits, { max: String(MAX_IMPORT_ROWS), mb: String(MAX_IMPORT_MB) }),
    formatMsg(m.insCompany, { company: companyMsg }),
  ];
  /* a wrapped paragraph needs its row tall enough to show; ~95 characters a
     line in the 100-wide column, 15pt a line */
  const tall = (text: string) => Math.max(15, Math.ceil(text.length / 95) * 15);
  const out: Cell[][] = [
    [{ value: t(formatMsg(m.insTitle, { company: companyMsg })), type: String, fontWeight: "bold" }],
    [],
  ];
  paragraphs.forEach((p, i) => {
    const text = t(p);
    out.push([
      { value: String(i + 1), type: String, alignVertical: "top" },
      null,
      { value: text, type: String, wrap: true, alignVertical: "top", height: tall(text) },
    ]);
  });
  out.push([]);
  out.push([
    { value: t(m.insColColumn), type: String, fontWeight: "bold" },
    { value: t(m.insColRequired), type: String, fontWeight: "bold" },
    { value: t(m.insColWhat), type: String, fontWeight: "bold" },
  ]);
  for (const f of IMPORT_FIELDS) {
    const isRequired = requiredImportFields(company).includes(f);
    out.push([
      { value: importHeader(f, company), type: String },
      { value: t(isRequired ? yes : no), type: String },
      { value: t(what[f]), type: String, wrap: true },
    ]);
  }
  return out;
}

/** THE TEMPLATE. Three tabs: this company's leads sheet, then the
    instructions in English and in Arabic (right-to-left).

    THE NUMBER COLUMN IS TEXT. Excel strips the leading zero from 01012345678
    the instant it is typed into a General cell, and every Egyptian mobile
    starts with 0 — the single most likely way an import silently corrupts
    data. So every typing cell of the sheet (header excepted) carries the "@"
    number format, the Number column above all: what is typed is kept exactly
    as typed. (The Created date column is Text for the matching reason: Excel
    would otherwise read 05/03/2024 by the machine's locale, and could swap the
    day and the month.) */
export async function buildImportTemplate(
  company: CrmCompany,
): Promise<{ buffer: Buffer; filename: string }> {
  const header: Cell[] = importHeaderRow(company).map((h) => ({
    value: h,
    type: String,
    fontWeight: "bold",
  }));
  const example: Cell[] = IMPORT_FIELDS.map((f) => ({
    value: IMPORT_EXAMPLE[f],
    type: String,
    format: TEXT,
    fontStyle: "italic",
  }));
  const blank: Cell[] = IMPORT_FIELDS.map(() => ({ type: String, format: TEXT }));
  const leads: Cell[][] = [header, example];
  for (let r = 3; r <= TEMPLATE_ROWS; r++) leads.push(blank);

  const typeColumn = columnLetter(IMPORT_FIELDS.indexOf("type"));
  const dropdown = listDropdown({
    sqref: `${typeColumn}2:${typeColumn}${TEMPLATE_ROWS}`,
    values: importTypeChoices(),
    title: "Type",
    message: `Pick one: ${importTypeChoices().join(", ")}`,
  });

  const instructionColumns = [{ width: 18 }, { width: 10 }, { width: 100 }];
  const buffer = await writeXlsxFile(
    [
      {
        data: leads,
        sheet: IMPORT_SHEET[company],
        stickyRowsCount: 1,
        columns: IMPORT_FIELDS.map((f) => ({ width: COLUMN_WIDTHS[f] })),
      },
      { data: instructionRows(company, "en"), sheet: m.sheetInstructions.en, columns: instructionColumns },
      {
        data: instructionRows(company, "ar"),
        sheet: m.sheetInstructions.ar,
        rightToLeft: true,
        columns: instructionColumns,
      },
    ] as Parameters<typeof writeXlsxFile>[0],
    { features: [dropdown] } as Parameters<typeof writeXlsxFile>[1],
  ).toBuffer();
  return { buffer, filename: importTemplateFilename(company) };
}

/* ---- WRITING: the skipped rows -------------------------------------------- */

/** The skipped rows as a file he can FIX AND IMPORT AGAIN: this company's
    sheet name, the template's own headers, every value as he typed it (as
    Text, so a number keeps its zero), then the row it came from and why it was
    skipped — two report columns the importer recognises and ignores. */
export async function buildSkippedWorkbook(
  company: CrmCompany,
  skipped: SkippedRow[],
  locale: Locale,
): Promise<Buffer> {
  const t = tFor(locale);
  const header: Cell[] = [
    ...importHeaderRow(company),
    REPORT_HEADERS.row,
    REPORT_HEADERS.reason,
  ].map((h) => ({ value: h, type: String, fontWeight: "bold" }));
  const rows: Cell[][] = skipped.map((s) => [
    ...IMPORT_FIELDS.map((f) => ({ value: s.values[f] || undefined, type: String, format: TEXT })),
    { value: String(s.row), type: String },
    { value: t(skipReasonsMsg(s.reasons, company)), type: String },
  ]);
  return writeXlsxFile([
    {
      data: [header, ...rows],
      sheet: IMPORT_SHEET[company],
      stickyRowsCount: 1,
      columns: [...IMPORT_FIELDS.map((f) => ({ width: COLUMN_WIDTHS[f] })), { width: 8 }, { width: 60 }],
    },
  ] as Parameters<typeof writeXlsxFile>[0]).toBuffer();
}
