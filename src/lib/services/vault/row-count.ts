/* ADR-053 — how many records a sheet holds, counted from the file itself so
   nobody has to keep the number up to date by hand (reference FR-S05/AC-04).

   The reference app's counting rules are re-implemented verbatim for CSV,
   which needs no dependency. XLSX/XLS are stored but NOT auto-counted here:
   the reference used exceljs for OOXML, and rebuilding on the CRM stack adds
   no spreadsheet parser (a new dependency needs its own ADR) — those sheets
   keep a MANUAL count with a required as-of date, exactly the path the
   reference app itself used for legacy .xls (its DV-05). The UI says which
   way the number was read, so it is always explicable.

   Header rule (the reference's ambiguity A-1, decided there and kept here):
   row 1 is a header when every non-empty cell in it reads as a LABEL and at
   least one cell in row 2 reads as a VALUE. Erring toward counting row 1 keeps
   a headerless list correct; the alternative silently undercounts by one. */

export type RowCountResult = {
  count: number;
  headerDetected: boolean;
  /** False when the format cannot be auto-counted (xlsx/xls) — the UI says why. */
  countable: boolean;
};

const isEmpty = (v: unknown) =>
  v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** "Looks like a value, not a label" — must work when every CSV cell is a string. */
function isValueLike(v: unknown): boolean {
  if (typeof v === "number" || typeof v === "boolean" || v instanceof Date) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s === "") return false;
  if (/^-?\d{1,3}(,\d{3})*(\.\d+)?$/.test(s) || /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(s)) return true;
  if (/^\d{4}-\d{2}-\d{2}([ T]|$)/.test(s)) return true; // ISO date
  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(s)) return true; // 12/07/2026
  if (/^-?\d+(\.\d+)?%$/.test(s)) return true;
  return false;
}

const isLabelLike = (v: unknown) => !isEmpty(v) && !isValueLike(v);

export function decideHeader(row1: unknown[], row2: unknown[] | undefined): boolean {
  const firstCells = row1.filter((c) => !isEmpty(c));
  if (firstCells.length === 0) return false;
  if (!firstCells.every(isLabelLike)) return false;
  if (!row2) return false;
  const secondCells = row2.filter((c) => !isEmpty(c));
  if (secondCells.length === 0) return false;
  return secondCells.some(isValueLike);
}

export function countRows(rows: unknown[][]): RowCountResult {
  const populated = rows.filter((r) => r.some((c) => !isEmpty(c)));
  if (populated.length === 0) return { count: 0, headerDetected: false, countable: true };

  const headerDetected = decideHeader(populated[0]!, populated[1]);
  return {
    count: headerDetected ? populated.length - 1 : populated.length,
    headerDetected,
    countable: true,
  };
}

/** Counts a CSV, honouring quoted fields and any of the four common delimiters. */
export function countCsv(buffer: Buffer): RowCountResult {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  return countRows(parseCsv(text));
}

/** Minimal RFC-4180 parse: quoted fields, escaped quotes, embedded newlines. */
function parseCsv(text: string): string[][] {
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch !== "\r") {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).slice(0, 10).join("\n");
  let best = ",";
  let bestCount = 0;
  for (const d of [",", ";", "\t", "|"]) {
    const count = sample.split(d).length - 1;
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Dispatch by the DETECTED extension, never the filename (reference BR-04). */
export function countRecords(buffer: Buffer, detectedExt: string): RowCountResult {
  if (detectedExt === "csv") return countCsv(buffer);
  // xlsx/xls — stored, not auto-counted (see the header note): manual count + as-of.
  return { count: 0, headerDetected: false, countable: false };
}
