import { redirect } from "next/navigation";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { crmQuery, crmRolesFor } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { CrmBoardBody } from "@/components/internal/pages";
import { BsCrmBoardBody, type BsBoardParams } from "@/components/bsystems/pages/BsCrmBoardBody";
import { BYTEFORCE_CTX } from "../ctx";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "CRM — B-Systems CRM" };

/* ADR-067 — THE board, and the founder's headline: "I can have a switch button
   between b systems and byte force, and the entire boards change accordingly."
   Two board components, chosen by company, one shared engine.

   They stay two on purpose. Each is statically bound at module level to its own
   stage set and config — INTERNAL_STAGES (six columns) against BSYSTEMS_STAGES
   (eight, with Negotiation and Postpone) — and that binding is a SAFETY
   property: a ByteForce card cannot be rendered into a negotiation column
   because the column does not exist in that module. Parameterising one board by
   config at runtime is how a negotiation column appears on a ByteForce board.
   CLAUDE.md forbids forking the ENGINE; it does not ask us to merge the views,
   and the engine here is already the one shared module.

   ADR-074 — the B-Systems body moved to components/bsystems/pages so Mindoo's
   own app renders that same board at /mindoo/crm. Mindoo is not a third board:
   it IS this one, at another address, under another brand. */

export default async function BsCrmPage({
  searchParams,
}: {
  searchParams: Promise<BsBoardParams & { company?: string }>;
}) {
  const params = await searchParams;
  const { user, company, companies } = await requireCompanyPage(params.company);
  if (company === "byteforce") return <CrmBoardBody ctx={BYTEFORCE_CTX} params={params} />;

  /* ADR-051 + ADR-067 — under ByteForce the company itself proves
     `byteforce_staff` (companiesFor only reports a company a role carries), so
     the role narrowing below applies to the B-SYSTEMS branch: the same four
     pipeline roles this page always accepted, with the data-entry account still
     carved out of it and sent to its one destination. */
  narrowRoles({ user, company, companies }, ...crmRolesFor(company));
  const engineRole = crmEngineRole(company, user);
  if (!engineRole) redirect(`/b-systems${crmQuery(company)}`);
  const role: BsFormRole =
    engineRole === "bsystems_admin"
      ? "admin"
      : engineRole === "bsystems_sales"
        ? "sales"
        : engineRole === "bsystems_agent"
          ? "agent"
          : "partner";

  return <BsCrmBoardBody ctx={BSYSTEMS_SURFACE} params={params} role={role} userId={user.id} />;
}
