import { leadsImportTemplateRoute } from "@/lib/api/leads-import-route";

/* The blank B-Systems import template. The company is the ROUTE (ADR-067's
   untouched wall); the guard is in the shared handler. */

export const GET = leadsImportTemplateRoute("bsystems");
