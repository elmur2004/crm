import { redirect } from "next/navigation";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmEngineRole } from "@/lib/api/bsystems";
import { crmQuery, crmRolesFor, oneValue, type CrmCompany } from "@/lib/crm/company";
import { searchHop, SWITCHED_PARAM } from "@/lib/crm/search-hop";
import type { Role } from "@/lib/pipeline-engine/constants";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { CrmBoardBody } from "@/components/internal/pages";
import { BsCrmBoardBody, type BsBoardParams } from "@/components/bsystems/pages/BsCrmBoardBody";
import { BYTEFORCE_CTX } from "../ctx";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "CRM — B-Systems CRM" };

/** This page's own address — handed to the hop and to the arrival notice so
    neither has to guess it, and a move of this route cannot leave them pointing
    at a 404. */
const BS_CRM_PATH = "/b-systems/crm";

/* ADR-085 — ONE SEARCH BOX, BOTH COMPANIES. Founder: "I want the search to be
   valid across both crm so if I searched for something and it's not in
   bsystesm's crm but it's in byteforce's it will automatically switch to
   byteforce crm and it will show me the lead."

   It runs in the PAGE rather than in a board body because the answer is a
   redirect, and the page is where the company and the roles have just been
   resolved. Every cheap check happens before any query, so an ordinary board
   load pays nothing: no search, a locked account, or a hop that already happened
   all return null without touching the database. The probe runs the TARGET
   BOARD'S OWN predicate, so it cannot find a row that board would not show — an
   agent only ever hops to his own card.

   It returns nothing and may never return at all: `redirect` throws. */
async function hopOrRender(
  user: { id: string; roles: Role[] },
  company: CrmCompany,
  params: BsBoardParams & { company?: string },
): Promise<void> {
  const hop = await searchHop({
    search: (oneValue(params.q) ?? "").trim(),
    user,
    current: company,
    path: BS_CRM_PATH,
    /* a plain record, because `searchHop` reads parameters BY NAME off the wire
       and must not be coupled to either board's params interface */
    params: { ...params },
  });
  if (hop) redirect(hop.url);
}

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

   ADR-074 — the B-Systems body lives in components/bsystems/pages so the board
   is a body a route renders rather than a page. */

export default async function BsCrmPage({
  searchParams,
}: {
  searchParams: Promise<BsBoardParams & { company?: string; [SWITCHED_PARAM]?: string }>;
}) {
  const params = await searchParams;
  const { user, company, companies } = await requireCompanyPage(params.company);

  if (company === "byteforce") {
    await hopOrRender(user, company, params);
    return (
      <CrmBoardBody
        ctx={BYTEFORCE_CTX}
        params={params}
        switchedFrom={{ path: BS_CRM_PATH, company }}
      />
    );
  }

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

  /* ADR-085 — AFTER the guards, deliberately. Both branches ask the same
     question, and each asks it only once the account has been proved able to
     render THIS company's board: a feature must never pre-empt a guard, and
     `narrowRoles` above is what carves `bsystems_data_entry` out of this screen
     (ADR-051). Running the hop earlier would have redirected a data-entry
     account holding both companies to the other company's board instead of to
     the one destination its role has. */
  await hopOrRender(user, company, params);

  return (
    <BsCrmBoardBody
      ctx={BSYSTEMS_SURFACE}
      params={params}
      role={role}
      userId={user.id}
      switchedFrom={{ path: BS_CRM_PATH, company }}
    />
  );
}
