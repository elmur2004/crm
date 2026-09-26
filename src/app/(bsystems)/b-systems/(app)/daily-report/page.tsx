import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";
import {
  dailyReportFor,
  type ReportCompany,
  type ReportScope,
} from "@/lib/services/daily-report";
import { DailyReportBody } from "@/components/shared/DailyReportBody";

export const metadata = { title: "Daily report — B-Systems CRM" };

/* ADR-081 — THE DAILY REPORT. One page for both of the merged shell's companies
   (the To-Do's and the Calendar's shape since ADR-067: the company rides the URL
   as `?company=`).

   THE ACTOR IS THE SESSION, taken here and nowhere else. There is no API route
   and no `userId` on any wire, because there is no report but your own —
   founder: "not the admin, not anyone — the user himself." That is also why this
   page needs no endpoint at all: it renders on the server and there is nothing
   to POST, which keeps it out of the route.ts half of the ADR-067 guard sweep.

   WHO MAY OPEN IT: `crmRolesFor(company)` — `byteforce_staff` under ByteForce,
   the four B-Systems pipeline roles under B-Systems. That is precisely "every
   role that can act on a lead", and it already carves out `bsystems_data_entry`:
   ADR-051 gave that account exactly one destination and ADR-071 refused it the
   calendar in as many words, so a capability it never had must not arrive
   through the side door of a new page. Flagged in PROGRESS rather than decided
   here.

   THE COMPANY REORDERS, IT DOES NOT FILTER. This is a report about a PERSON'S
   DAY, so it spans every company the account HOLDS (ADR-071: "the company
   decides WHOSE entries you are shown, never whose time is real"), each one
   under its OWN scope. Pressing the switch puts the company you switched to at
   the top of each day — which is what keeps the page honest about the switch
   instead of ignoring it — and the page copy says the content covers both, or
   the switch would read as broken (ADR-067 §8's failure mode). */

/** The three branches of `requireLeadAccess`, exactly as the To-Do and the
    Calendar compute them: admin all, internal sales the internal bucket, agent
    and partner their own leads. */
function bsystemsScope(role: Role | null, userId: string): ReportScope {
  if (role === "bsystems_admin") return { kind: "all" };
  if (role === "bsystems_sales") return { kind: "internal" };
  return { kind: "own", userId };
}

export default async function DailyReportPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const params = await searchParams;
  const page = await requireCompanyPage(params.company);
  const { user, company, companies } = page;
  /* ADR-073 — ONE company-aware narrowing, before any branch. Under ByteForce
     the company itself proves `byteforce_staff` (companiesFor only ever reports a
     company a role already carries), so this is the real wall for B-Systems' four
     and a no-op there. */
  narrowRoles(page, ...crmRolesFor(company));

  /* THE SWITCH REORDERS, IT DOES NOT FILTER: the company you are looking at leads
     each day's list, so pressing it has a visible effect on the one screen whose
     content is the same either way. It is also the explicit `company === "byteforce"`
     branch nav.test.ts reads this file for — a shared page without one falls
     through to the B-Systems role narrowing and bounces every ByteForce teammate
     off the nav item he was just handed. */
  const primary: Brand = company === "byteforce" ? "byteforce" : "bsystems";

  const bsRole = bsRoleOrNull(user);
  const scoped: ReportCompany[] = companies.map((held) =>
    held === "byteforce"
      ? { brand: "byteforce", scope: { kind: "all" } }
      : { brand: "bsystems", scope: bsystemsScope(bsRole, user.id) },
  );

  const now = new Date();
  const report = await dailyReportFor({ actorId: user.id, companies: scoped, primary, now });
  return <DailyReportBody report={report} viewerName={user.name} now={now} />;
}
