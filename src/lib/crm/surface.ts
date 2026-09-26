import type { Brand } from "@/lib/pipeline-engine/constants";
import { crmQuery } from "./company";

/* ============================================================================
   ADR-074 — the SURFACE: which application instance is rendering.

   ADR-080 — there is one surface again. Mindoo was the second, and removing it
   leaves this object holding a single value, which is exactly why it stays: the
   five shared pipeline bodies (the Leads table, the board, the lead detail, the
   call sheet, Won Leads) take a surface rather than reaching for the literals
   "/b-systems", "/api/b-systems" and "?company=". Those literals live HERE and
   nowhere else, and that is the property that made a second address possible at
   all. Collapsing it back into hardcoded strings would un-earn it.

   `query` is the seam that matters most: under this shell the company rides the
   URL (ADR-067's `?company=`), and every href in every shared body ends with
   `ctx.query` rather than appending it conditionally.
   ========================================================================== */

export interface CrmSurface {
  /** the brand every service call is scoped by — the DATA wall */
  brand: Brand;
  /** the app root: "/b-systems" */
  basePath: string;
  /** the API namespace: "/api/b-systems". Derived from the ROUTE on the server
      side and never from a parameter — the wall ADR-067 refused to touch. */
  apiBase: string;
  /** "?company=bsystems" — the merged shell's company parameter */
  query: string;
  /** the value for the hidden `company` input a plain method="get" filter form
      needs so submitting it does not drop the company from the query string.
      NULLABLE because a surface with no company parameter to preserve must be
      able to say so: rendering an empty one would put `?company=` on every
      filtered URL and invite `parseCompany` to read junk. */
  companyParam: Brand | null;
}

export const BSYSTEMS_SURFACE: CrmSurface = {
  brand: "bsystems",
  basePath: "/b-systems",
  apiBase: "/api/b-systems",
  query: crmQuery("bsystems"),
  companyParam: "bsystems",
};

/* ============================================================================
   ADR-074 — THE LEAD'S ADDRESS, for the code that is not a page.

   Three places build a link to a lead from OUTSIDE any surface: the calendar
   projection, the To-Do projection and the push deep-link. Each was a ternary on
   the brand, each fell through to the wrong company's address, and the bug was
   invisible until somebody clicked their own To-Do row.

   They are services, not pages: they cannot take a `CrmSurface` (the same
   projection feeds every reader, and push has no request at all). So the table
   lives here, beside the surface it agrees with, and is TOTAL over `Brand` — a
   third company is a compile error rather than a silent fall-through.
   ========================================================================== */

const LEAD_ADDRESS: Record<Brand, { base: string; query: string }> = {
  /* B-Systems' leads live on the board's own detail; ByteForce's on the rep
     directory's — two screens at one prefix, told apart by `?company=`. */
  bsystems: { base: "/b-systems/crm/lead", query: "?company=bsystems" },
  byteforce: { base: "/b-systems/leads/lead", query: "?company=byteforce" },
};

/** Where a lead of this brand is READ. */
export function leadHref(brand: Brand, leadId: string): string {
  const a = LEAD_ADDRESS[brand];
  return `${a.base}/${leadId}${a.query}`;
}

/** That brand's app root — where a push with no lead behind it any more lands. */
export function appHomeFor(brand: Brand): string {
  return `/b-systems?company=${brand}`;
}
