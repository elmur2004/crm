import { redirect } from "next/navigation";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { crmHomeFor } from "@/lib/crm/nav";
import { crmQuery, crmRolesFor } from "@/lib/crm/company";
import { parseRange } from "@/lib/dashboard/periods";
import { getLocale } from "@/lib/i18n/server";
import { DashboardBody } from "@/components/dashboard/DashboardBody";

/* a page of Reports & Dashboards now (one way to each page) */
export const metadata = { title: "Dashboard — Reports & Dashboards" };

/* V2 §2.1 — admin Home; non-admins land on their CRM board.

   ADR-067 — one of the FOUR addresses both companies share, so it branches on
   the company before it does anything else. Both companies now render ONE
   body (components/dashboard — the dashboard upgrade), fed by one service call
   whose every lead predicate is the To-Do's wall. The B-Systems-only figures
   (agents, partners, milestones, Needs you) are produced only for the
   B-Systems admin, and are never queried under ByteForce.

   `?range=` is the period (This month by default); an unknown value renders
   the default rather than an error, so a stale link still opens. */

export default async function BSystemsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; range?: string | string[] }>;
}) {
  const params = await searchParams;
  const { user, company, companies } = await requireCompanyPage(params.company);
  const range = parseRange(params.range);
  const locale = await getLocale();

  if (company === "byteforce") {
    /* ByteForce staff see every ByteForce lead (SPEC §3) — the To-Do's
       { kind: "all" } under brand byteforce */
    return (
      <DashboardBody
        company="byteforce"
        scope={{ kind: "all" }}
        range={range}
        locale={locale}
        viewerName={user.name}
      />
    );
  }

  /* ADR-051 + ADR-067 — under ByteForce the company itself proves
     `byteforce_staff` (companiesFor only reports a company a role carries), so
     the role narrowing below applies to the B-SYSTEMS branch: the same four
     pipeline roles this page always accepted, with the data-entry account still
     carved out of it and sent to its one destination.

     ADR-074 — only the admin gets here; everybody else is bounced to their own
     first destination, which by construction accepts that company and that
     role, so the bounce cannot ping-pong. (Homes for sales, agents and
     partners are the dashboard spec's Phase B, a founder decision — D9.) */
  narrowRoles({ user, company, companies }, ...crmRolesFor(company));
  const role = crmEngineRole(company, user);
  if (role !== "bsystems_admin") redirect(`${crmHomeFor(company, role)}${crmQuery(company)}`);

  return (
    <DashboardBody
      company="bsystems"
      scope={{ kind: "all" }}
      range={range}
      locale={locale}
      viewerName={user.name}
      showBackup
    />
  );
}
