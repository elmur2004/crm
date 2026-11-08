import type { ReactNode } from "react";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { isCompanyAdmin, leadScopeFor } from "@/lib/auth/lead-scope";
import { todoFor, type TodoItem, type TodoScope } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";
import { CompanyTabs } from "@/components/shared/CompanyTabs";
import { workingCompaniesFor } from "@/lib/launcher/apps";
import { TodoRowActions, type TodoAssign } from "@/components/bsystems/TodoRowActions";
import { listAssignableOwners, listByteforceOwners } from "@/lib/services/users";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";
import { regRoleBadges } from "@/lib/i18n/dict/admin";

/* the ByteForce roster's one role, in the Registrations screen's own words */
const bfStaffLabel: Msg = regRoleBadges.byteforce_staff!;

/* its own app now (one way to each page): named as its launcher tile is */
export const metadata = { title: "To-Do" };

/* Founder (ADR-041, ADR-061) — everything dated today, one plain list (the
   Overdue section and the partnership rows are gone by his instruction).
   Scope mirrors requireLeadAccess (founder 2026-11-08): the company admin all,
   everybody else their own leads; statement/milestone rows are admin-only.

   ONE WAY TO EACH PAGE — the To-Do is its own launcher app with this one page,
   so it has no menu. For an account that works leads in BOTH companies the
   page carries company TABS (CompanyTabs): a filter on this page, the one
   thing the retired company switch did here. */

const TODO_PATH = "/b-systems/todo";

export default async function BsTodoPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { user, company, companies } = await requireCompanyPage((await searchParams).company);

  /* ADR-067 — the shared To-Do, one page for both companies. */
  /* ADR-073 — ONE narrowing, company-aware, before any branch. Each company's
     own role list lives in crmRolesFor; under ByteForce the company itself
     already proves `byteforce_staff`, so this is a no-op there and the real
     wall for B-Systems' five. */
  narrowRoles({ user, company, companies }, ...crmRolesFor(company));
  /* the tabs: every company in which this account WORKS leads — the same
     predicate the To-Do tile uses to pick the first one (lib/launcher/apps.ts),
     so a tab can never lead to a To-Do the guard above would bounce */
  const working = workingCompaniesFor(user.roles);
  const tabs =
    working.length > 1 ? <CompanyTabs path={TODO_PATH} current={company} companies={working} /> : null;

  /* Founder (2026-11-08, "assigned leads only" — both companies): the company
     admin's To-Do is every lead's; everybody else's is the leads they OWN — a
     follow-up handed to him lands HERE on its date. One rule, lead-scope.ts. */
  const scope: TodoScope = leadScopeFor(user, company);
  const lists = await todoFor({ brand: company, scope });
  const apiBase = company === "byteforce" ? "/api/byteforce" : "/api/b-systems";

  /* Founder — "I can assign these to do as an admin or just take it myself":
     the COMPANY ADMIN ONLY, in both companies now. B-Systems' roster is the
     lead-detail page's (agents / partners / internal sales — deliberately no
     admins; "Take it" is the only admin path), ByteForce's is its live staff
     accounts (the admin left out for the same reason); the role labels are
     pre-translated here. */
  let rowActions: ((item: TodoItem) => ReactNode) | undefined;
  if (isCompanyAdmin(user, company)) {
    const locale = await getLocale();
    const t = tFor(locale);
    const roleLabels: Record<string, Msg> = roleMsgs;
    const owners =
      company === "byteforce"
        ? (await listByteforceOwners())
            .filter((o) => o.id !== user.id)
            .map((o) => ({ id: o.id, name: o.name, company: null, roleLabel: t(bfStaffLabel) }))
        : (await listAssignableOwners()).map((o) => ({
            id: o.id,
            name: o.name,
            company: o.company,
            roleLabel: t(
              roleLabels[o.roles.find((r) => roleLabels[r]) ?? ""] ?? roleMsgs.bsystems_agent,
            ),
          }));
    const assign: TodoAssign = { owners, selfUserId: user.id, locale, apiBase, company };
    rowActions = (item) => <TodoRowActions item={item} assign={assign} />;
  }
  return <TodoBody lists={lists} apiBase={apiBase} rowActions={rowActions} tabs={tabs} />;
}
