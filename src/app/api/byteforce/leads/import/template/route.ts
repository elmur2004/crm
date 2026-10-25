import { leadsImportTemplateRoute } from "@/lib/api/leads-import-route";

/* The blank ByteForce import template. The company is the ROUTE (ADR-067's
   untouched wall); the guard is in the shared handler. */

export const GET = leadsImportTemplateRoute("byteforce");
