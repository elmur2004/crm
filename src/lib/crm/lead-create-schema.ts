import { z } from "zod";
import { LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import type { CrmCompany } from "./company";

/* ============================================================================
   THE RULES A NEW LEAD MUST SATISFY — one schema per company, in one place.

   Moved here VERBATIM out of services/leads.ts (which re-exports it, so every
   existing importer keeps its address) for one reason: the Excel import has to
   validate a thousand rows against exactly the rules the "Add lead" form is
   held to, BEFORE it writes anything, and it has to do that from a module that
   does not open a database connection. A second copy of these limits in the
   importer is the thing this file exists to prevent — the day somebody raises
   `name` to 300, the form and the import move together.

   Pure: zod and the lead-type list, nothing else.
   ========================================================================== */

export const createLeadSchema = z.object({
  salesRepId: z.string().optional(), // A-6: optional for partner-sourced leads
  name: z.string().min(1).max(200),
  number: z.string().min(1).max(50),
  email: z.string().email().optional().or(z.literal("").transform(() => undefined)),
  type: z.enum(LEAD_TYPES),
  description: z.string().max(2000).optional(),
  // V2 §1 — ex-portal deal fields, optional on every lead
  position: z.string().max(200).optional(),
  companyName: z.string().max(200).optional(),
  industry: z.string().max(200).optional(),
  requirements: z.string().max(4000).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;

/* founder: on B-Systems, the company name is MANDATORY at creation.
   (ByteForce + partner-attributed routes keep the shared optional schema.)
   Lifted from the B-Systems create route unchanged — message included — so the
   route and the import share it rather than each carrying a copy. */
const bsCreateLeadSchema = createLeadSchema.extend({
  companyName: z.string().min(1, "Company name is required").max(200),
});

/** The schema a NEW lead of this company is held to — the Leads page's own
    "Add lead" rules. B-Systems requires the company name; ByteForce does not. */
export function createLeadSchemaFor(company: CrmCompany) {
  return company === "bsystems" ? bsCreateLeadSchema : createLeadSchema;
}
