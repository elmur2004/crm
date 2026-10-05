import { leadsExportRoute } from "@/lib/api/leads-export-route";

/* ADR-083 — B-Systems' whole lead list as a spreadsheet. The company is the
   ROUTE (ADR-067's untouched wall); the guard is in the shared handler. */

export const GET = leadsExportRoute("bsystems");
