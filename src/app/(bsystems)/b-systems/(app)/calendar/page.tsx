import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { BYTEFORCE_CTX } from "../ctx";
import { leadScopeFor } from "@/lib/auth/lead-scope";
import type { CalendarScope } from "@/lib/services/calendar";
import {
  CalendarPageBody,
  type CalendarBodyParams,
} from "@/components/shared/CalendarPageBody";

export const metadata = { title: "Calendar — B-Systems CRM" };

/* ADR-071 — the calendar, one page for both of the merged shell's companies
   (the To-Do's shape since ADR-067: the company rides the URL as `?company=`,
   and so does the month).

   The scope is the To-Do's, deliberately and not by coincidence: the company
   admin all, everybody else their own leads (lead-scope.ts). It is handed
   to the service, which turns everything outside it into a "busy" block rather
   than dropping it.

   ADR-074 — the calendar is a shared BODY a route renders, under its
   own guard and its own scope. */

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<CalendarBodyParams & { company?: string }>;
}) {
  const params = await searchParams;
  const page = await requireCompanyPage(params.company);
  const { user, company } = page;

  /* ADR-067 — under ByteForce the company itself proves `byteforce_staff`
     (companiesFor only ever reports a company a role already carries), so no
     role narrowing applies beyond it. Falling through to the B-Systems
     narrowing instead would bounce every ByteForce teammate off the nav item he
     was just handed, which is the regression nav.test.ts reads this file to
     prevent. ADR-073 — one company-aware narrowing, before the branch. */
  narrowRoles(page, ...crmRolesFor(company));

  /* Founder (2026-11-08, "assigned leads only") — ONE rule for both
     companies: the company admin's meetings in full, everybody else's own;
     every other meeting stays on the grid as a "busy" block. */
  const scope: CalendarScope = leadScopeFor(user, company);

  if (company === "byteforce") {
    return (
      <CalendarPageBody
        ctx={BYTEFORCE_CTX}
        scope={scope}
        userId={user.id}
        params={params}
      />
    );
  }

  return (
    <CalendarPageBody
      ctx={BSYSTEMS_SURFACE}
      scope={scope}
      userId={user.id}
      params={params}
    />
  );
}
