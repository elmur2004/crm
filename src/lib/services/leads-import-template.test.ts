import { strFromU8, unzipSync, zipSync } from "fflate";
import readExcelFile from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import {
  IMPORT_EXAMPLE,
  IMPORT_FIELDS,
  IMPORT_SHEET,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  importHeaderRow,
} from "@/lib/crm/leads-import";
import { SpreadsheetNumber } from "@/lib/crm/leads-import-plan";
import { leadTypeMsgs } from "@/lib/i18n/dict/labels";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { importFile, row } from "@/tests/leads-import-file";
import {
  ImportFileError,
  buildImportTemplate,
  buildSkippedWorkbook,
  readImportWorkbook,
  zipDeclaredSize,
} from "./leads-import";

/* ============================================================================
   THE TEMPLATE AND THE READER, proven on real bytes.

   ADR-083's lesson, applied to the inverse: a claim about a spreadsheet is
   proven by READING THE FILE BACK — semantically with a reader, and as raw XML
   for the structural claims a reader cannot make (is the Number column really
   formatted as Text, is the dropdown really there, is the Arabic sheet really
   right-to-left).
   ========================================================================== */

const unzip = (buf: Buffer) => unzipSync(new Uint8Array(buf));
const xml = (buf: Buffer, file: string) => strFromU8(unzip(buf)[file]!);

/** The number format code applied to one cell (e.g. "@" for Text), read from
    sheet1.xml's style index and styles.xml's cellXfs/numFmts. */
function formatOf(buf: Buffer, ref: string): string | null {
  const sheet = xml(buf, "xl/worksheets/sheet1.xml");
  const styles = xml(buf, "xl/styles.xml");
  const cell = new RegExp(`<c r="${ref}"([^>]*)>|<c r="${ref}"([^>]*)/>`).exec(sheet);
  if (!cell) return null;
  const s = /\bs="(\d+)"/.exec(cell[1] ?? cell[2] ?? "")?.[1];
  if (s === undefined) return null;
  const xfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(styles)![1]!.match(/<xf\b[^>]*>/g)!;
  const numFmtId = /numFmtId="(\d+)"/.exec(xfs[Number(s)]!)?.[1];
  if (numFmtId === undefined) return null;
  if (numFmtId === "49") return "@"; // Excel's built-in Text
  return new RegExp(`<numFmt numFmtId="${numFmtId}" formatCode="([^"]*)"`).exec(styles)?.[1] ?? null;
}

async function refusal(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ImportFileError) return { status: err.status, ...err.body };
    throw err;
  }
  throw new Error("expected the file to be refused");
}

/* -------------------------------------------------------------------------- */

describe("the template", () => {
  it("is a real .xlsx with the company's leads sheet and BOTH instructions sheets", async () => {
    const { buffer, filename } = await buildImportTemplate("bsystems");
    expect(filename).toBe("b-systems-leads-import-template.xlsx");
    expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
    const sheets = await readExcelFile(buffer);
    expect(sheets.map((s) => s.sheet)).toEqual(["B-Systems leads", "Instructions", "التعليمات"]);
    expect((await buildImportTemplate("byteforce")).filename).toBe("byteforce-leads-import-template.xlsx");
  });

  it("has ONE header row of the stable machine-readable names, starred where required", async () => {
    for (const company of ["bsystems", "byteforce"] as const) {
      const { buffer } = await buildImportTemplate(company);
      const [leads] = await readExcelFile(buffer);
      expect(leads!.sheet).toBe(IMPORT_SHEET[company]);
      expect(leads!.data[0]).toEqual(importHeaderRow(company));
    }
    const { buffer } = await buildImportTemplate("bsystems");
    expect((await readExcelFile(buffer))[0]!.data[0]).toEqual([
      "Name*", "Number*", "Type*", "Email", "Company*", "Position", "Industry", "Requirements", "Description", "Created date",
    ]);
  });

  it("row 2 is the clearly-marked example, in italics", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    const [leads] = await readExcelFile(buffer);
    expect(leads!.data[1]).toEqual(IMPORT_FIELDS.map((f) => IMPORT_EXAMPLE[f]));
    expect(String(leads!.data[1]![0])).toMatch(/^EXAMPLE/);
    const styles = xml(buffer, "xl/styles.xml");
    expect(styles).toMatch(/<i\/>|<i val="1"\/>|<i>/);
  });

  it("THE NUMBER COLUMN IS TEXT — every row a lead can be typed into, not just the example", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    const sheet = xml(buffer, "xl/worksheets/sheet1.xml");
    /* the example's number is a TEXT cell, its zero intact */
    expect(sheet).toMatch(/<c r="B2"[^>]*t="s"/);
    expect(xml(buffer, "xl/sharedStrings.xml")).toContain("<t>01000000000</t>");
    expect(sheet).not.toContain("<v>1000000000</v>");
    for (const ref of ["B2", "B3", "B500", `B${MAX_IMPORT_ROWS + 2}`]) {
      expect(formatOf(buffer, ref), ref).toBe("@");
    }
    /* and the Created date column, so Excel cannot swap a day and a month */
    for (const ref of ["J2", "J3", `J${MAX_IMPORT_ROWS + 2}`]) expect(formatOf(buffer, ref), ref).toBe("@");
    /* the header itself is not a typing cell */
    expect(formatOf(buffer, "B1")).toBeNull();
  });

  it("offers the real lead types as an in-cell dropdown on the Type column", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    const sheet = xml(buffer, "xl/worksheets/sheet1.xml");
    const dv = /<dataValidation [^>]*>[\s\S]*?<\/dataValidation>/.exec(sheet)?.[0] ?? "";
    expect(dv).toContain('type="list"');
    expect(dv).toContain(`sqref="C2:C${MAX_IMPORT_ROWS + 2}"`);
    expect(dv).toContain('errorStyle="stop"');
    const list = LEAD_TYPES.map((t) => leadTypeMsgs[t].en).join(",");
    expect(dv.replace(/&quot;/g, '"')).toContain(`<formula1>"${list}"</formula1>`);
    /* the schema's element order: after sheetData, before anything later */
    expect(sheet.indexOf("<dataValidations")).toBeGreaterThan(sheet.indexOf("</sheetData>"));
  });

  it("freezes the header row", async () => {
    const { buffer } = await buildImportTemplate("byteforce");
    expect(xml(buffer, "xl/worksheets/sheet1.xml")).toMatch(/<pane [^>]*ySplit="1"[^>]*state="frozen"/);
  });

  it("explains itself in English AND Arabic — required fields, types, duplicates, unassigned", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    const sheets = await readExcelFile(buffer);
    const text = (i: number) => sheets[i]!.data.flat().filter(Boolean).join("\n");
    const en = text(1);
    const ar = text(2);
    expect(en).toContain("How to fill in this template — B-Systems");
    expect(en).toContain("Columns marked * are required: Name*, Number*, Type*, Company*.");
    expect(en).toContain("Cold call, Event data, Personal connection, Campaign lead, Organic");
    expect(en).toContain("is skipped and listed in the result — the existing lead is never changed");
    expect(en).toContain("Imported leads arrive UNASSIGNED");
    expect(en).toContain("01012345678");
    expect(en).toContain("Created date (optional)");
    expect(ar).toContain("طريقة ملء هذا النموذج — B-Systems");
    expect(ar).toContain("الأعمدة المعلَّمة بـ * إلزامية");
    expect(ar).toContain("اتصال مباشر");
    expect(ar).toContain("يصل العملاء المحتملون المستوردون دون إسناد");
    expect(ar).toContain("ولا يُعدَّل العميل المحتمل الموجود أبدًا");
    /* the field table names every column of the leads sheet */
    for (const h of importHeaderRow("bsystems")) {
      expect(en).toContain(h);
      expect(ar).toContain(h);
    }
    /* ByteForce's instructions do not ask for a company */
    const bf = await readExcelFile((await buildImportTemplate("byteforce")).buffer);
    expect(bf[1]!.data.flat().join("\n")).toContain("Columns marked * are required: Name*, Number*, Type*.");
  });

  it("the Arabic instructions sheet is right-to-left; the others are not", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    expect(xml(buffer, "xl/worksheets/sheet3.xml")).toContain('rightToLeft="1"');
    expect(xml(buffer, "xl/worksheets/sheet2.xml")).not.toContain('rightToLeft="1"');
    expect(xml(buffer, "xl/worksheets/sheet1.xml")).not.toContain('rightToLeft="1"');
  });

  it("is small, and declares a sane unpacked size", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    expect(buffer.length).toBeLessThan(200 * 1024);
    const declared = zipDeclaredSize(buffer)!;
    expect(declared).toBeGreaterThan(buffer.length);
    expect(declared).toBeLessThan(5 * 1024 * 1024);
  });
});

/* -------------------------------------------------------------------------- */

describe("reading an upload", () => {
  it("the untouched template is refused as EMPTY (its only row is the example)", async () => {
    const { buffer } = await buildImportTemplate("bsystems");
    expect(await refusal(readImportWorkbook(buffer, "bsystems"))).toMatchObject({ status: 400, code: "empty" });
  });

  it("reads a filled file into rows with Excel's row numbers and the cell TYPES kept", async () => {
    const buf = await importFile("bsystems", [
      row("Text Zero", "01012345678"),
      row("Lost Zero", 1012345678),
      row("Dated", "01033333333", "Cold call", { createdAt: new Date("2024-03-15T00:00:00.000Z") }),
    ]);
    const rows = await readImportWorkbook(buf, "bsystems");
    expect(rows.map((r) => r.row)).toEqual([2, 3, 4]);
    expect(rows[0]!.cells.number).toBe("01012345678");
    /* the numeric cell is told apart — that is the whole leading-zero rule */
    expect(rows[1]!.cells.number).toBeInstanceOf(SpreadsheetNumber);
    expect((rows[1]!.cells.number as SpreadsheetNumber).raw).toBe("1012345678");
    expect(rows[2]!.cells.createdAt).toBeInstanceOf(Date);
  });

  it("refuses what is not an .xlsx at all — a text file, a legacy .xls, a random zip", async () => {
    expect(await refusal(readImportWorkbook(Buffer.from("Name,Number\nA,010"), "bsystems"))).toMatchObject({ code: "not_xlsx" });
    const ole2 = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)]);
    expect(await refusal(readImportWorkbook(ole2, "bsystems"))).toMatchObject({ code: "not_xlsx" });
    const zip = Buffer.from(zipSync({ "hello.txt": new TextEncoder().encode("hi") }));
    expect(await refusal(readImportWorkbook(zip, "bsystems"))).toMatchObject({ status: 400 });
  });

  it("refuses a file that is NOT THE TEMPLATE, naming the columns", async () => {
    const buf = await importFile("bsystems", [["A", "B"]], { header: ["Full name", "Phone"], sheet: "Sheet1" });
    const r = await refusal(readImportWorkbook(buf, "bsystems"));
    expect(r).toMatchObject({ status: 400, code: "wrong_template" });
    expect(r.missing).toEqual(["Name*", "Number*", "Type*", "Company*"]);
    expect(r.unexpected).toEqual(["Full name", "Phone"]);
    expect(r.error).toContain("This file is not the import template");
  });

  it("refuses the OTHER company's template", async () => {
    const bf = await importFile("byteforce", [row("A", "01011111111")]);
    const r = await refusal(readImportWorkbook(bf, "bsystems"));
    expect(r).toMatchObject({ status: 400, code: "wrong_company", otherCompany: "byteforce" });
    expect(r.error).toBe(
      "This is the ByteForce template, and you are importing into B-Systems. Download the B-Systems template, or switch to ByteForce first.",
    );
    /* and the right company reads it */
    expect(await readImportWorkbook(bf, "byteforce")).toHaveLength(1);
  });

  it("a sheet he named himself is read from its first tab, if its headers are the template's", async () => {
    const buf = await importFile("byteforce", [row("A", "01011111111")], { sheet: "My list" });
    expect(await readImportWorkbook(buf, "byteforce")).toHaveLength(1);
  });

  it(`refuses more than ${MAX_IMPORT_ROWS} leads — with the count, not a timeout`, async () => {
    const rows = Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => row(`L${i}`, `0101${String(i).padStart(7, "0")}`));
    const r = await refusal(readImportWorkbook(await importFile("bsystems", rows), "bsystems"));
    expect(r).toMatchObject({ status: 413, code: "too_many_rows", rows: MAX_IMPORT_ROWS + 1 });
    expect(r.error).toBe("The file has 1001 leads — at most 1000 can be imported at once. Split it into smaller files.");
    /* exactly the limit is fine */
    expect(await readImportWorkbook(await importFile("bsystems", rows.slice(0, MAX_IMPORT_ROWS)), "bsystems")).toHaveLength(MAX_IMPORT_ROWS);
  });

  it("refuses a file over the size limit, and a zip that DECLARES too much unpacked", async () => {
    const big = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(MAX_IMPORT_BYTES)]);
    expect(await refusal(readImportWorkbook(big, "bsystems"))).toMatchObject({ status: 413, code: "too_large" });
    /* 41 MB of zeros deflates to a few kilobytes: the zip-bomb shape */
    const bomb = Buffer.from(zipSync({ "xl/worksheets/sheet1.xml": new Uint8Array(41 * 1024 * 1024) }, { level: 9 }));
    expect(bomb.length).toBeLessThan(MAX_IMPORT_BYTES);
    expect(await refusal(readImportWorkbook(bomb, "bsystems"))).toMatchObject({ status: 413, code: "too_large" });
  });

  it("refuses a header with no rows under it as EMPTY", async () => {
    expect(await refusal(readImportWorkbook(await importFile("bsystems", []), "bsystems"))).toMatchObject({ code: "empty" });
  });
});

/* -------------------------------------------------------------------------- */

describe("the skipped-rows file", () => {
  it("is re-importable: the company's sheet, the template's headers, numbers kept as Text", async () => {
    const buf = await buildSkippedWorkbook(
      "bsystems",
      [
        {
          row: 7,
          values: { ...Object.fromEntries(IMPORT_FIELDS.map((f) => [f, ""])), name: "Bad", number: "0221000001", type: "Walk in" } as never,
          reasons: [{ code: "unknownType", value: "Walk in" }],
        },
      ],
      "en",
    );
    const [sheet] = await readExcelFile(buf);
    expect(sheet!.sheet).toBe("B-Systems leads");
    expect(sheet!.data[0]).toEqual([...importHeaderRow("bsystems"), "Row", "Skipped because"]);
    expect(sheet!.data[1]![1]).toBe("0221000001");
    expect(String(sheet!.data[1]![11])).toContain("“Walk in” is not a lead type");
    /* and the reader accepts it straight back */
    const rows = await readImportWorkbook(buf, "bsystems");
    expect(rows[0]!.cells.number).toBe("0221000001");
  });
});
