import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { BYTEFORCE_CTX } from "../ctx";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import type { CalendarScope } from "@/lib/services/calendar";
import {
  CalendarPageBody,
  type CalendarBodyParams,
} from "@/components/shared/CalendarPageBody";

export const metadata = { title: "Calendar — B-Systems CRM" };

/* ADR-071 — the calendar, one page for both of the merged shell's companies
   (the To-Do's shape since ADR-067: the company rides the URL as `?company=`,
   and so does the month).

   The scope is the To-Do's, deliberately and not by coincidence: admin all,
   sales the internal bucket, agents and partners their own leads. It is handed
   to the service, which turns everything outside it into a "busy" block rather
   than dropping it.

   ADR-074 — Mindoo's calendar is the same BODY at /mindoo/calendar, under its
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
     (companiesFor only ever reports a company a role already carries), and that
     role has always seen every ByteForce lead — so the scope is the whole
     company and no role narrowing applies. Falling through to the B-Systems
     narrowing instead would bounce every ByteForce teammate off the nav item he
     was just handed, which is the regression nav.test.ts reads this file to
     prevent. ADR-073 — one company-aware narrowing, before the branch. */
  narrowRoles(page, ...crmRolesFor(company));

  if (company === "byteforce") {
    return (
      <CalendarPageBody
        ctx={BYTEFORCE_CTX}
        scope={{ kind: "all" }}
        userId={user.id}
        params={params}
      />
    );
  }

  const role = bsRoleOrNull(user);
  const scope: CalendarScope =
    role === "bsystems_admin"
      ? { kind: "all" }
      : role === "bsystems_sales"
        ? { kind: "internal" }
        : { kind: "own", userId: user.id };

  return (
    <CalendarPageBody
      ctx={BSYSTEMS_SURFACE}
      scope={scope}
      userId={user.id}
      params={params}
    />
  );
}
