import { crmQuery } from "@/lib/crm/company";
import type { InternalAppCtx } from "@/components/internal/pages";

/* ADR-067 — the merged shell's two contexts.

   Both live at the SAME basePath now: /b-systems is the one CRM address, and
   which company you are looking at rides the query string. What deliberately
   does NOT move is the API base — /api/byteforce stays the ByteForce namespace
   and /api/b-systems stays the B-Systems one, because the brand is derived from
   the ROUTE there and never from input. That is the wall this merge must not
   touch: a `company` parameter on an API route would be the single way to widen
   access, so there isn't one, and the merged pages simply call the right base. */

export const BYTEFORCE_CTX: InternalAppCtx = {
  brand: "byteforce",
  company: "byteforce",
  basePath: "/b-systems",
  apiBase: "/api/byteforce",
  query: crmQuery("byteforce"),
};

export const BSYSTEMS_CTX: InternalAppCtx = {
  brand: "bsystems",
  company: "bsystems",
  basePath: "/b-systems",
  apiBase: "/api/b-systems",
  query: crmQuery("bsystems"),
};
