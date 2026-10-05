import { redirect } from "next/navigation";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { crmHomeFor } from "@/lib/crm/nav";
import { crmQuery, crmRolesFor } from "@/lib/crm/company";
import { leadsExportCompanies } from "@/lib/crm/leads-export";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { LeadsBody } from "@/components/internal/pages";
import { BsLeadsBody, type BsLeadsParams } from "@/components/bsystems/pages/BsLeadsBody";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "Leads — B-Systems CRM" };

/* ADR-067 — the shared Leads address, and the two companies mean genuinely
   different screens by it. ByteForce's Leads is a directory of SALES REP CARDS
   with an Unassigned bucket and a per-rep drill-down (which is also the only
   door to its archive); B-Systems' is a flat filterable table with owner
   buckets. Two bodies, one address, chosen by the company — never merged into
   "the leads table", which would quietly lose the rep directory.

   ADR-074 — the B-Systems body lives in components/bsystems/pages, so this
   table is a body a route renders. What is left here is the
   guard, which is the only thing that was ever company-specific. */

export default async function BsLeadsPage({
  searchParams,
}: {
  searchParams: Promise<BsLeadsParams & { company?: string }>;
}) {
  const params = await searchParams;
  const { user, company, companies } = await requireCompanyPage(params.company);
  /* ADR-083 — the two export buttons. Computed HERE, from the live roles, and
     handed to whichever body renders: both buttons for an account that can open
     both companies' Leads pages, one for an account that can open one, none for
     an account that could somehow reach this screen with neither (impossible
     today — the guards below prove the company — and it must still fail
     closed). Note it is NOT `companies`: an account holding both companies but
     only `bsystems_sales` on the B-Systems side can open the ByteForce Leads
     page and not the B-Systems one, so it is shown exactly one button. */
  const exportCompanies = leadsExportCompanies(user.roles);
  if (company === "byteforce") {
    return <LeadsBody ctx={BYTEFORCE_CTX} exportCompanies={exportCompanies} />;
  }

  /* ADR-051 + ADR-067 — under ByteForce the company itself proves
     `byteforce_staff` (companiesFor only reports a company a role carries), so
     the role narrowing below applies to the B-SYSTEMS branch: the same four
     pipeline roles this page always accepted, with the data-entry account still
     carved out of it and sent to its one destination. */
  narrowRoles({ user, company, companies }, ...crmRolesFor(company));
  const role = crmEngineRole(company, user);
  if (role !== "bsystems_admin") redirect(`${crmHomeFor(company, role)}${crmQuery(company)}`);

  return (
    <BsLeadsBody ctx={BSYSTEMS_SURFACE} params={params} exportCompanies={exportCompanies} />
  );
}
