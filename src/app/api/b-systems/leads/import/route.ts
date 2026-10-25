import { leadsImportRoute } from "@/lib/api/leads-import-route";

/* Import leads from Excel into B-Systems. The company is the ROUTE (ADR-067's
   untouched wall); the guard is in the shared handler. */

export const POST = leadsImportRoute("bsystems");
