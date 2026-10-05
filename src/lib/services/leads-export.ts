import writeXlsxFile from "write-excel-file/node";
import { db } from "@/lib/db";
import { utcToCairo } from "@/lib/datetime";
import { toPounds } from "@/lib/money";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { leadTypeLabel, ownerTypeLabel, stageLabel } from "@/lib/i18n/dict/labels";
import { leadsExport as m } from "@/lib/i18n/dict/crm";
import type { CrmCompany } from "@/lib/crm/company";
import {
  leadExportStatus,
  leadExportStatusMsgs,
  leadsExportFilename,
  leadsExportSheetName,
} from "@/lib/crm/leads-export";

/* ============================================================================
   THE LEADS EXPORT — the half that touches the database and writes the file.

   Founder: "add a button to export all leads in an excel sheet", and the sheet
   is EVERY LEAD, EVER — "live pipeline, won, lost AND archived — with a column
   saying which".

   A REAL .xlsx, NOT A CSV, and that is a correctness decision rather than a
   taste one:

     · every Egyptian mobile in this table starts with a 0 ("01012345678"), and
       Excel strips a leading zero from a CSV the moment it opens it — silently
       corrupting the single field the sheet exists for, the one he calls from;
     · the table is full of Arabic names, which Excel mis-decodes from a CSV
       without a byte-order mark.

   So the phone is written as a TEXT cell (it lands in sharedStrings, zero
   intact) and every other column is written with its REAL type: dates are date
   cells with a display format, money and counts are numbers. A spreadsheet
   whose columns are all strings is a screenshot with extra steps — he cannot
   sort it by date or sum a column.

   THE LIBRARY is `write-excel-file` (ADR-083). Imported from its `/node` entry
   and only ever from this module, which is only ever imported by the two route
   handlers — so it never reaches a client bundle.

   SCALE: the whole sheet is BUFFERED (see `buildLeadsWorkbook`). Measured and
   argued in ADR-083 §5 rather than discovered in production.
   ========================================================================== */

/* ---- the DATE trap, fixed once ------------------------------------------- */

/** An Excel date cell is a serial number with NO time zone, and
    `write-excel-file` derives that serial from `date.getTime()` — i.e. it reads
    the `Date` as UTC. Every instant in this database is UTC and every screen in
    this product displays it in Africa/Cairo (SPEC §2), so handing Prisma's
    `Date` straight to a cell would print a lead created at 01:00 Cairo on the
    6th as the 5th — the app and the sheet disagreeing about the day.

    So the cell carries the CAIRO WALL CLOCK pinned to UTC: the same
    `utcToCairo` every screen formats through, re-assembled as a UTC instant so
    the serial comes out as the hands of a Cairo clock. */
function cairoCell(instant: Date): Date {
  const { date, time } = utcToCairo(instant);
  return new Date(`${date}T${time}:00.000Z`);
}

/** The same, truncated to the START of the Cairo day.

    For the follow-up column, where ADR-061 made the date the whole record and
    ADR-063 exists precisely to stop printing a clock nobody chose: a stored
    09:00 is the DEFAULT, not a time the submitter picked. Midnight also makes
    Excel's own date filter exact — "equals 06/10/2026" does not match a serial
    carrying a fraction. */
function cairoDayCell(instant: Date): Date {
  return new Date(`${utcToCairo(instant).date}T00:00:00.000Z`);
}

/* ---- cell formats -------------------------------------------------------- */

/* ADR-068 — a TWELVE-HOUR clock everywhere a person reads a time, so the two
   columns that carry a real instant print AM/PM like every screen does. */
const DATE_TIME_FORMAT = "dd/mm/yyyy hh:mm AM/PM";
const DATE_FORMAT = "dd/mm/yyyy";
/* Money stays a plain number with thousands separators; the unit lives in the
   HEADER ("Value (EGP)"). A currency literal inside a numFmt would have to be
   quoted into the styles XML, and SPEC §2 has exactly one currency to name. */
const MONEY_FORMAT = "#,##0.00";

/* ---- the query ----------------------------------------------------------- */

/** EVERY lead of one company — archived included, no filter, no parameter.

    Deliberately takes nothing but the brand. The Leads page's filters are
    narrowing controls on a screen; his sentence was "every lead, ever", and an
    export that honoured the current filters would hand him a file whose
    contents depend on a query string he has forgotten he set. It also means
    there is no client-controlled input on this path at all.

    Ordered newest-added first — the Leads table's own default ordering
    (`sortLeads`'s "added"), so the file opens in the order of the screen the
    button sits on. */
export function fetchLeadsForExport(brand: CrmCompany) {
  return db.lead.findMany({
    where: { brand },
    include: {
      owner: { select: { name: true } },
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
      /* ByteForce wins write a WonInfo, B-Systems wins a WonDeal (the engine's
         two win side effects) — the value column reads whichever exists. */
      wonInfo: { select: { estimatedValue: true } },
      wonDeal: { select: { estimatedValue: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export type ExportableLead = Awaited<ReturnType<typeof fetchLeadsForExport>>[number];

/* ---- the columns --------------------------------------------------------- */

/* Derived from the Lead model and its record tables rather than guessed, and
   trimmed of everything that would make the sheet harder to read:

     · `description` / `requirements` / `negotiationNotes` — paragraphs. One of
       them in a cell makes every row as tall as its longest note.
     · `createdByUserId` ("added by", ADR-051) — a FOURTH person-column beside
       Owner, Sales rep and Partner, answering a question nobody asked of this
       file. It is on the lead's History, where it belongs.
     · the lead id — a cuid is noise to a human, and the sheet is for calling
       people, not for joining tables.
     · `source` — it says "partner" exactly when the Partner column is filled,
       so it is the same fact twice.
     · `readyToClose` — an internal notification flag (V2 §3), not a property of
       the customer.

   WhatsApp is a Yes/No rather than a Boolean cell: Excel renders a real boolean
   as the English words TRUE/FALSE in every language, and this file is
   bilingual. */
interface ExportColumn {
  key: string;
  header: Msg;
  width: number;
  cell: (lead: ExportableLead, locale: Locale) => Cell;
}

type Cell =
  | null
  | { value: string; type: StringConstructor }
  | { value: number; type: NumberConstructor; format?: string }
  | { value: Date; type: DateConstructor; format: string };

const text = (value: string | null | undefined): Cell =>
  value == null || value === "" ? null : { value, type: String };

const number = (value: number | null | undefined, format?: string): Cell =>
  value == null ? null : { value, type: Number, ...(format ? { format } : {}) };

const yesNo: Record<"yes" | "no", Msg> = { yes: m.yes, no: m.no };

/** The value a person means by "what is this deal worth": the newest proposal's
    estimate, and when a lead was won without one, the won record's own figure.
    Stored in piasters everywhere (ADR-018) — the cell carries POUNDS, because
    nobody filters a spreadsheet in minor units. */
function valueInPounds(lead: ExportableLead): number | null {
  const piasters =
    lead.proposals[0]?.estimatedValue ??
    lead.wonInfo?.estimatedValue ??
    lead.wonDeal?.estimatedValue ??
    null;
  return piasters == null ? null : toPounds(piasters);
}

export const LEAD_EXPORT_COLUMNS: readonly ExportColumn[] = [
  { key: "name", header: m.hName, width: 28, cell: (l) => text(l.name) },
  { key: "company", header: m.hCompany, width: 26, cell: (l) => text(l.companyName) },
  /* THE COLUMN THIS FEATURE IS ABOUT. `type: String` puts it in sharedStrings,
     so "01012345678" survives as eleven characters rather than becoming the
     number 1012345678 the moment Excel opens the file. */
  { key: "phone", header: m.hNumber, width: 16, cell: (l) => text(l.number) },
  { key: "email", header: m.hEmail, width: 26, cell: (l) => text(l.email) },
  { key: "position", header: m.hPosition, width: 20, cell: (l) => text(l.position) },
  { key: "industry", header: m.hIndustry, width: 18, cell: (l) => text(l.industry) },
  {
    key: "type",
    header: m.hType,
    width: 18,
    cell: (l, locale) => text(leadTypeLabel(locale, l.type)),
  },
  {
    key: "stage",
    header: m.hStage,
    width: 20,
    cell: (l, locale) => text(stageLabel(locale, l.stage)),
  },
  {
    key: "status",
    header: m.hStatus,
    width: 12,
    cell: (l, locale) => text(leadExportStatusMsgs[leadExportStatus(l)][locale]),
  },
  {
    key: "ownerBucket",
    header: m.hOwnerBucket,
    width: 14,
    cell: (l, locale) => text(ownerTypeLabel(locale, l.ownerType)),
  },
  { key: "owner", header: m.hOwner, width: 20, cell: (l) => text(l.owner?.name) },
  { key: "salesRep", header: m.hSalesRep, width: 20, cell: (l) => text(l.salesRep?.name) },
  {
    key: "partner",
    header: m.hPartner,
    width: 24,
    cell: (l) => text(l.partner?.companyName),
  },
  {
    key: "created",
    header: m.hCreated,
    width: 20,
    cell: (l) => ({ value: cairoCell(l.createdAt), type: Date, format: DATE_TIME_FORMAT }),
  },
  {
    key: "lastActivity",
    header: m.hLastActivity,
    width: 20,
    cell: (l) => ({ value: cairoCell(l.updatedAt), type: Date, format: DATE_TIME_FORMAT }),
  },
  {
    key: "nextFollowUp",
    header: m.hFollowUp,
    width: 20,
    /* ADR-063 — the clock is printed only when somebody CHOSE it. A blank
       `dueTimeSet` means the stored 09:00 is the ADR-061 default, so the cell is
       the Cairo day and its format carries no time. */
    cell: (l) => {
      const fu = l.followUps[0];
      if (!fu) return null;
      return fu.dueTimeSet
        ? { value: cairoCell(fu.dueAt), type: Date, format: DATE_TIME_FORMAT }
        : { value: cairoDayCell(fu.dueAt), type: Date, format: DATE_FORMAT };
    },
  },
  {
    key: "latestMeeting",
    header: m.hMeeting,
    width: 20,
    /* a meeting can be recorded with no slot yet (V2 §3's "needs arranging"),
       and an empty cell is the honest rendering of that */
    cell: (l) => {
      const at = l.meetings[0]?.datetime;
      return at ? { value: cairoCell(at), type: Date, format: DATE_TIME_FORMAT } : null;
    },
  },
  {
    key: "value",
    header: m.hValue,
    width: 16,
    cell: (l) => number(valueInPounds(l), MONEY_FORMAT),
  },
  {
    key: "lostReason",
    header: m.hLostReason,
    width: 30,
    /* free text (LostInfo.reason is required but open) — printed as typed */
    cell: (l) => text(l.lostInfo[0]?.reason),
  },
  /* ADR-064's tally. A real number, including the honest 0, so the column sums
     and sorts — "how many times we tried" is the question it was added for. */
  { key: "noAnswer", header: m.hNoAnswer, width: 12, cell: (l) => number(l.noAnswerCount) },
  {
    key: "whatsapp",
    header: m.hWhatsapp,
    width: 14,
    /* ADR-069 — the mark is the RECORD's, so this is "has anybody messaged
       them", which is exactly what the green chip means on screen. */
    cell: (l, locale) => text(yesNo[l.whatsappSentAt ? "yes" : "no"][locale]),
  },
];

/* ---- the sheet ----------------------------------------------------------- */

/** The header row + one row per lead, in the viewer's language. Pure: it takes
    rows that have already been read, so the shape of the file is testable
    without a request. */
export function leadExportSheet(leads: ExportableLead[], locale: Locale): Cell[][] {
  const header: Cell[] = LEAD_EXPORT_COLUMNS.map((c) => ({
    value: c.header[locale],
    type: String,
  }));
  return [header, ...leads.map((lead) => LEAD_EXPORT_COLUMNS.map((c) => c.cell(lead, locale)))];
}

/** The whole download: the bytes, the filename and the row count.

   SCALE — "all leads, ever" grows without bound, so this says what happens
   rather than leaving it to be found out. BOTH halves BUFFER: Prisma
   materialises every row of the company (plus its newest follow-up, meeting,
   proposal and lost row), and `write-excel-file` assembles the sheet XML and
   zips it in memory before a single byte is sent. There is no streaming here.

   MEASURED on this schema and these 21 columns, with Arabic in a third of the
   names and every optional record present (ADR-083 §5):

     10,000 leads → 0.85 MB xlsx · 2.8 s · 75 MB heap · 227 MB RSS
     50,000 leads → 4.2 MB xlsx · 13 s · 251 MB heap · 558 MB RSS
    100,000 leads → 8.4 MB xlsx · 28 s · 462 MB heap · 983 MB RSS

   So TEN THOUSAND IS FINE — three seconds and under 100 MB of heap for a
   founder pressing a button, on a database that holds a few hundred leads
   today. WHERE IT BREAKS is a TIMEOUT, not a crash: around 50,000 rows the wall
   clock starts brushing a 30 s platform request limit, and at 100,000 the
   resident set is within a hair of a 1 GB container. That is the point to
   stream (`toStream`, which the library also offers) and to read the leads in
   cursor-paged batches instead of one `findMany` — deliberately not built
   today, because streaming costs the row count in the response and the product
   is two orders of magnitude away from needing it. Written down so the next
   person finds the threshold instead of rediscovering it in production. */
export async function buildLeadsWorkbook(
  company: CrmCompany,
  locale: Locale,
): Promise<{ buffer: Buffer; filename: string; rows: number }> {
  const leads = await fetchLeadsForExport(company);
  const t = tFor(locale);
  const buffer = await writeXlsxFile(leadExportSheet(leads, locale), {
    sheet: t(leadsExportSheetName),
    /* "an Arabic export sets the sheet right-to-left" — the columns run from
       the right and Excel's own frame flips with them */
    rightToLeft: locale === "ar",
    /* the header stays put through ten thousand rows */
    stickyRowsCount: 1,
    columns: LEAD_EXPORT_COLUMNS.map((c) => ({ width: c.width })),
  }).toBuffer();
  return {
    buffer,
    filename: leadsExportFilename(company, utcToCairo(new Date()).date),
    rows: leads.length,
  };
}
