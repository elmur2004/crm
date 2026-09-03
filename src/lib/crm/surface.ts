import type { Brand } from "@/lib/pipeline-engine/constants";
import { crmQuery } from "./company";

/* ============================================================================
   ADR-074 — the SURFACE: which application instance is rendering.

   Founder: "I need to have the system for mindoo completly identical to
   byteforce but with no partners or regestrations or agents or their crm at
   all... also remove the switcher from bsystems system seperate them entirly
   nothing inside bsystems goes to mindoo and vice versa."

   So Mindoo stopped being a segment of the merged shell and became its own app
   at /mindoo, with its own brand on <html>, its own nav, its own API namespace
   and no switch onto or off it. What it did NOT become is a second copy of the
   pipeline screens: it runs the same B-Systems-shaped pipeline (the founder's
   own choice when asked), so the Leads table, the board, the lead detail, the
   call sheet and Won Leads are ONE implementation each, rendered at two
   addresses.

   This object is the difference between those two addresses, and it is the
   whole difference. A body that reaches for a literal "/b-systems", a literal
   "/api/b-systems" or a literal "?company=" instead of asking the surface is
   the one way a Mindoo screen can link a reader back into B-Systems — the
   exact leak the founder asked us to close — so the bodies take this and the
   literals live only here.

   `query` is the seam that matters most. Under B-Systems the company rides the
   URL (ADR-067's `?company=`) because that shell serves two companies; under
   Mindoo it is the EMPTY STRING, because /mindoo serves exactly one and a
   company parameter there would be a second, contradictory answer to a question
   the route has already settled. Nothing appends it conditionally: every href
   in every shared body ends with `ctx.query`, which is either the parameter or
   nothing at all.
   ========================================================================== */

export interface CrmSurface {
  /** the brand every service call is scoped by — the DATA wall */
  brand: Brand;
  /** the app root: "/b-systems" | "/mindoo" */
  basePath: string;
  /** the API namespace: "/api/b-systems" | "/api/mindoo". Derived from the
      ROUTE on the server side and never from a parameter — the wall ADR-067
      refused to touch and ADR-074 keeps. */
  apiBase: string;
  /** "?company=bsystems" under the merged shell, "" under Mindoo */
  query: string;
  /** the value for the hidden `company` input a plain method="get" filter form
      needs so submitting it does not drop the company from the query string.
      NULL under Mindoo, where there is no company parameter to preserve —
      rendering an empty one would put `?company=` on every filtered URL and
      invite `parseCompany` to read junk. */
  companyParam: Brand | null;
}

export const BSYSTEMS_SURFACE: CrmSurface = {
  brand: "bsystems",
  basePath: "/b-systems",
  apiBase: "/api/b-systems",
  query: crmQuery("bsystems"),
  companyParam: "bsystems",
};

export const MINDOO_SURFACE: CrmSurface = {
  brand: "mindoo",
  basePath: "/mindoo",
  apiBase: "/api/mindoo",
  query: "",
  companyParam: null,
};

/* ============================================================================
   ADR-074 — THE LEAD'S ADDRESS, for the code that is not a page.

   Three places build a link to a lead from OUTSIDE any surface: the calendar
   projection, the To-Do projection, and the push deep-link. Every one of them
   was a ternary on the brand, and every one of them fell through to a
   B-SYSTEMS address for Mindoo — so a Mindoo meeting, a Mindoo To-Do row and a
   Mindoo mention push all pointed at /b-systems/…, which the proxy now refuses
   for `mindoo_staff`. Clicking any of them logged the user out.

   They are services, not pages: they cannot take a `CrmSurface` (the same
   projection feeds two shells at once, and push has no request at all). So the
   table lives here, beside the surfaces it agrees with, and is TOTAL over
   `Brand` — a fourth company is a compile error rather than another silent
   fall-through to B-Systems.
   ========================================================================== */

const LEAD_ADDRESS: Record<Brand, { base: string; query: string }> = {
  /* B-Systems' leads live on the board's own detail; ByteForce's on the rep
     directory's — two screens at one prefix, told apart by `?company=`. */
  bsystems: { base: "/b-systems/crm/lead", query: "?company=bsystems" },
  byteforce: { base: "/b-systems/leads/lead", query: "?company=byteforce" },
  /* and Mindoo's is Mindoo's, with no company on it at all */
  mindoo: { base: "/mindoo/crm/lead", query: "" },
};

/** Where a lead of this brand is READ. */
export function leadHref(brand: Brand, leadId: string): string {
  const a = LEAD_ADDRESS[brand];
  return `${a.base}/${leadId}${a.query}`;
}

/** That brand's app root — where a push with no lead behind it any more lands. */
export function appHomeFor(brand: Brand): string {
  return brand === "mindoo" ? "/mindoo" : `/b-systems?company=${brand}`;
}
