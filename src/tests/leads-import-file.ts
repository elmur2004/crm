import writeXlsxFile from "write-excel-file/node";
import { IMPORT_SHEET, importHeaderRow } from "@/lib/crm/leads-import";
import type { CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   TEST FIXTURE — an .xlsx shaped exactly like a filled-in import template.

   Each cell is written with the TYPE Excel would have given it, because that
   is what the importer's rules are about:
     · a string  → a TEXT cell (what the template's "@" columns produce);
     · a number  → a NUMERIC cell (what Excel makes of 01012345678 typed into a
                   General cell: the number 1012345678 — the zero is gone);
     · a Date    → a DATE cell (a date pasted from another sheet);
     · null      → an empty cell.
   ========================================================================== */

export type FixtureCell = string | number | Date | null;

function cell(value: FixtureCell) {
  if (value === null) return null;
  if (typeof value === "number") return { value, type: Number };
  if (value instanceof Date) return { value, type: Date, format: "dd/mm/yyyy" };
  return { value, type: String, format: "@" };
}

/** Rows UNDER the header, in the template's column order (Name, Number, Type,
    Email, Company, Position, Industry, Requirements, Description, Created
    date). Short rows are padded with empty cells. */
export async function importFile(
  company: CrmCompany,
  rows: FixtureCell[][],
  opts: { sheet?: string; header?: string[]; extraSheets?: string[] } = {},
): Promise<Buffer> {
  const header = opts.header ?? importHeaderRow(company);
  const data = [
    header.map((h) => ({ value: h, type: String })),
    ...rows.map((r) => header.map((_, i) => cell(r[i] ?? null))),
  ];
  const sheets = [
    { data, sheet: opts.sheet ?? IMPORT_SHEET[company] },
    ...(opts.extraSheets ?? []).map((name) => ({ data: [[{ value: "x", type: String }]], sheet: name })),
  ];
  return writeXlsxFile(sheets as Parameters<typeof writeXlsxFile>[0]).toBuffer();
}

/** One minimal valid row: name, number, type — plus the company B-Systems needs. */
export function row(
  name: string,
  number: FixtureCell,
  type: FixtureCell = "Cold call",
  extra: { email?: string; company?: string; createdAt?: FixtureCell } = {},
): FixtureCell[] {
  return [
    name,
    number,
    type,
    extra.email ?? null,
    extra.company ?? "Acme Trading",
    null,
    null,
    null,
    null,
    extra.createdAt ?? null,
  ];
}
