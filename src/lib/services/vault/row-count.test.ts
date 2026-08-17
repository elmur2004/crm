import { describe, expect, it } from "vitest";
import { countCsv, countRecords, countRows, decideHeader } from "./row-count";
import { sniffText } from "@/lib/storage";

/* ADR-053 — the reference app's counting + sniffing heuristics, kept honest. */

describe("decideHeader (the reference's A-1 rule)", () => {
  it("labels over values → header", () => {
    expect(decideHeader(["Name", "Phone"], ["Salma", "01001112223"])).toBe(true);
  });
  it("all-text rows → NOT a header (headerless list stays correct)", () => {
    expect(decideHeader(["Salma", "notes here"], ["Omar", "more notes"])).toBe(false);
  });
  it("no second row → not a header", () => {
    expect(decideHeader(["Name", "Phone"], undefined)).toBe(false);
  });
});

describe("countCsv", () => {
  it("counts populated rows minus a detected header", () => {
    const csv = Buffer.from("Name,Phone\nSalma,0100111\nOmar,0122333\n\n");
    expect(countCsv(csv)).toEqual({ count: 2, headerDetected: true, countable: true });
  });

  it("ignores blank rows and honours quoted delimiters + embedded newlines", () => {
    /* all-text columns: the A-1 rule deliberately reads row 1 as DATA (no
       value-like cell in row 2), so a headerless list is never undercounted */
    const csv = Buffer.from('Name,Note\nSalma,"likes, commas"\nOmar,"two\nlines"\n');
    expect(countCsv(csv)).toEqual({ count: 3, headerDetected: false, countable: true });
  });

  it("semicolon-delimited files are detected too", () => {
    const csv = Buffer.from("Name;Amount\nA;1\nB;2\nC;3\n");
    expect(countCsv(csv)).toEqual({ count: 3, headerDetected: true, countable: true });
  });

  it("an empty file counts zero", () => {
    expect(countRows([])).toEqual({ count: 0, headerDetected: false, countable: true });
  });
});

describe("countRecords dispatch", () => {
  it("csv is countable; xlsx/xls are stored-not-counted (manual count + as-of)", () => {
    expect(countRecords(Buffer.from("a,b\n1,2\n"), "csv").countable).toBe(true);
    expect(countRecords(Buffer.alloc(64), "xlsx").countable).toBe(false);
    expect(countRecords(Buffer.alloc(64), "xls").countable).toBe(false);
  });
});

describe("sniffText (the CSV/TXT content sniff shared with the upload rules)", () => {
  it("consistent delimiter → csv", () => {
    expect(sniffText(Buffer.from("a,b,c\n1,2,3\n4,5,6\n"))).toBe("csv");
  });
  it("prose → txt", () => {
    expect(sniffText(Buffer.from("Dear team,\nthis is just a letter.\nRegards\n"))).toBe("txt");
  });
  it("NUL bytes → binary, refused", () => {
    expect(sniffText(Buffer.from([0x61, 0x00, 0x62, 0x63, 0x64]))).toBe(null);
  });
});
