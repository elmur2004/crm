import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import type { CrmSurface } from "@/lib/crm/surface";
import { crmQuery } from "@/lib/crm/company";

/* ADR-067 — the merged shell's two surfaces.

   Both live at the SAME basePath: /b-systems is the one CRM address, and which
   company you are looking at rides the query string. What deliberately does NOT
   move is the API base — /api/byteforce stays the ByteForce namespace and
   /api/b-systems stays the B-Systems one, because the brand is derived from the
   ROUTE there and never from input. That is the wall this merge must not touch:
   a `company` parameter on an API route would be the single way to widen access
   across companies, so there isn't one, and the merged pages simply call the
   right base.

   ADR-074 — B-Systems' half moved to lib/crm/surface.ts, because Mindoo needs
   the same shape and a surface is not a property of this route group. This file
   keeps ByteForce's, which IS: nothing outside the merged shell renders it. */

export const BYTEFORCE_CTX: CrmSurface = {
  brand: "byteforce",
  companyParam: "byteforce",
  basePath: "/b-systems",
  apiBase: "/api/byteforce",
  query: crmQuery("byteforce"),
};

export const BSYSTEMS_CTX: CrmSurface = BSYSTEMS_SURFACE;
