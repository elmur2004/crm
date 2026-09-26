import { crmQuery, type CrmCompany } from "./company";

/* ============================================================================
   ADR-067 — WHERE THE COMPANY SWITCH LANDS YOU.

   Founder, on the switch: "make sure that this is there, and there is no
   confusion in it." A path that exists for BOTH companies keeps the path across
   a switch; every other address — a company-exclusive section, or any deep link
   with a record id in it — falls back to that company's Home, because the
   equivalent screen either does not exist or is about a record belonging to the
   other company.

   ADR-081 moved this out of components/shared/CompanySwitch.tsx, which is a
   client component and therefore could not be unit tested in this suite at all.
   Two things came out of that the moment it could be:

     · the CALENDAR was never added when ADR-071 shipped it, so switching company
       from /b-systems/calendar silently dropped the reader on the dashboard —
       a bug nothing could have caught, because no test referenced this list.
     · the DAILY REPORT is the one screen whose CONTENT does not change across
       the switch (it is a report about a person's day, not a pipeline), so
       bouncing it to Home would be the most confusing possible answer.
   ========================================================================== */

/** The addresses that exist under BOTH companies. */
export const SHARED_PATHS = [
  "/b-systems",
  "/b-systems/todo",
  "/b-systems/calendar", // ADR-071 — shipped shared, never listed here until ADR-081
  "/b-systems/daily-report", // ADR-081
  "/b-systems/leads",
  "/b-systems/crm",
];

export function targetFor(pathname: string, company: CrmCompany): string {
  const path = SHARED_PATHS.includes(pathname) ? pathname : "/b-systems";
  return `${path}${crmQuery(company)}`;
}
