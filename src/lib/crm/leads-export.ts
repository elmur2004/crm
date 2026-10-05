import type { Msg } from "@/lib/i18n/core";
import { leadsExport as m } from "@/lib/i18n/dict/crm";
import type { Role } from "@/lib/pipeline-engine/constants";
import { companiesFor, type CrmCompany } from "./company";

/* ============================================================================
   THE LEADS EXPORT — the pure half.

   Founder, verbatim: "add a button to export all leads in an excel sheet / a
   button for bsystems and a button for byteforce", on THE LEADS PAGE, and the
   sheet holds "every lead, ever — live pipeline, won, lost AND archived — with
   a column saying which".

   Pure: no Prisma, no next-auth, no spreadsheet library, no React. The two
   routes, the two buttons and the unit tests all import the SAME predicate, so
   "who may pull a company's entire customer list" is answered in exactly one
   place — the law lib/crm/company.ts states for the company itself.

   THE LAW OF THIS FILE: `canExportLeads` NARROWS. It reads the roles an account
   already holds and reports whether that account can already READ the whole of
   that company's Leads page. There is no branch here that hands anybody a
   company a role does not carry, and `leads-export-wall.test.ts` proves the
   equivalence against the page guards themselves rather than against a second
   copy of this table.
   ========================================================================== */

/** WHO may export, per company — and it is deliberately the Leads PAGE's own
    role set, not a looser one.

    Worked out from the guards rather than guessed (src/app/(bsystems)/b-systems/(app)/leads/page.tsx):

      · ByteForce   `requireCompanyPage` resolves `byteforce` only for an
                    account whose roles carry it (`companiesFor` narrows), so
                    reaching that branch IS proof of `byteforce_staff`. One
                    role, and the page is a directory of every rep's leads.

      · B-Systems   the page narrows to BS_PIPELINE_ROLES and then redirects
                    anything that is not `bsystems_admin` to its own board. So
                    admin, and nobody else.

    THE CONSEQUENCE, stated because it is the whole point of the feature's risk:
    `bsystems_sales`, `bsystems_agent`, `bsystems_partner` and
    `bsystems_data_entry` CANNOT export. An agent or a partner sees only its own
    leads anywhere in this product (requireLeadAccess), and a company-wide file
    is the one object that would undo that in a single click — so the wall is
    the page's, unchanged, and never `staffRolesForBrand("bsystems")`, which
    would have let internal sales pull the admin's whole book.

    `bsystems_data_entry` is excluded twice over: it is carved out of
    BS_PIPELINE_ROLES (ADR-051) and it is not the admin. */
export const LEADS_EXPORT_ROLES: Record<CrmCompany, readonly [Role, ...Role[]]> = {
  bsystems: ["bsystems_admin"],
  byteforce: ["byteforce_staff"],
};

/** May these roles export THIS company's whole lead list?

    Both halves are required and the company one comes first: an account must
    hold the company at all (`companiesFor`, the narrowing predicate) AND hold
    the role the Leads page demands of that company. Either alone is a hole —
    the company alone would let a `bsystems_sales` account export, and the role
    alone is how a table like the one above drifts away from the guard. */
export function canExportLeads(roles: Role[], company: CrmCompany): boolean {
  if (!companiesFor(roles).includes(company)) return false;
  return LEADS_EXPORT_ROLES[company].some((r) => roles.includes(r));
}

/** The companies whose button this account is shown, in CRM_COMPANIES order.

    A ByteForce-only teammate sees one button; an account holding both CRM
    companies but only `bsystems_sales` on the B-Systems side sees ONE — the
    ByteForce one — because that is the only Leads page it can open. The button
    set and the route's refusal are the same function, so the UI can never offer
    a download the server then refuses. */
export function leadsExportCompanies(roles: Role[]): CrmCompany[] {
  return companiesFor(roles).filter((c) => canExportLeads(roles, c));
}

/** Where a company's export is FETCHED.

    ADR-067's untouched wall: the brand lives in the ROUTE, never in a
    parameter. There is no `?company=` on these endpoints and there must never
    be one — it would be the single way to widen this across companies, and this
    endpoint hands over an entire customer list. */
const LEADS_EXPORT_HREF: Record<CrmCompany, string> = {
  bsystems: "/api/b-systems/leads/export",
  byteforce: "/api/byteforce/leads/export",
};

export function leadsExportHref(company: CrmCompany): string {
  return LEADS_EXPORT_HREF[company];
}

/* ---- the STATUS column ----------------------------------------------------

   His own words: "live pipeline, won, lost AND archived — with a column saying
   which". Four values, and two of them overlap in the data: `archived` is a
   FLAG and won/lost are STAGES, so a won lead can also be archived.

   ARCHIVED WINS. It is the answer to "where did this lead go" — an archived row
   appears on no screen in the product, and a sheet that called it "Won" would
   send him looking for a card that is not there. Nothing is lost by the
   precedence either: the Stage column sits immediately before Status and still
   reads "Won", so filtering the sheet by Stage counts every win including the
   archived ones. */

export const LEAD_EXPORT_STATUSES = ["live", "won", "lost", "archived"] as const;
export type LeadExportStatus = (typeof LEAD_EXPORT_STATUSES)[number];

export function leadExportStatus(lead: { stage: string; archived: boolean }): LeadExportStatus {
  if (lead.archived) return "archived";
  if (lead.stage === "won") return "won";
  if (lead.stage === "lost") return "lost";
  return "live";
}

export const leadExportStatusMsgs: Record<LeadExportStatus, Msg> = {
  live: m.statusLive,
  won: m.statusWon,
  lost: m.statusLost,
  archived: m.statusArchived,
};

/** `byteforce-leads-2026-10-06.xlsx` — the company and the CAIRO day, because
    the founder downloads one file per company and both land in one folder.

    The date is Cairo's, not the server's: the accounting export's own
    `exportFilename` convention (`{company}-accounting-{YYYY-MM-DD}.json`), and
    a file stamped with yesterday because the box runs UTC is a support
    question nobody should have to answer. The caller passes the day — this
    file stays pure. */
export function leadsExportFilename(company: CrmCompany, cairoDate: string): string {
  const stem = company === "bsystems" ? "b-systems" : "byteforce";
  return `${stem}-leads-${cairoDate}.xlsx`;
}

/** The sheet's own tab name, in the viewer's language. */
export const leadsExportSheetName: Msg = m.sheet;
