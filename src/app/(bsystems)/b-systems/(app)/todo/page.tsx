import type { ReactNode } from "react";
import { narrowRoles, requireCompanyPage } from "@/lib/auth/page-guards";
import { crmRolesFor } from "@/lib/crm/company";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { todoFor, type TodoItem, type TodoScope } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";
import { CompanyTabs } from "@/components/shared/CompanyTabs";
import { workingCompaniesFor } from "@/lib/launcher/apps";
import { TodoRowActions, type TodoAssign } from "@/components/bsystems/TodoRowActions";
import { listAssignableOwners } from "@/lib/services/users";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";

/* its own app now (one way to each page): named as its launcher tile is */
export const metadata = { title: "To-Do" };

/* Founder (ADR-041, ADR-061) — everything dated today, one plain list (the
   Overdue section and the partnership rows are gone by his instruction).
   Scope mirrors requireLeadAccess: admin all, sales internal bucket,
   agents/partners their own leads; statement/milestone rows are admin-only.

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

  /* ADR-067 — the shared To-Do. Under ByteForce it is the plain daily list all
     ByteForce staff have always seen: every ByteForce lead, and NO admin row
     actions — assigning an owner is a B-Systems admin subsystem (its roster
     and its endpoint are B-Systems-locked), so it is not offered here. */
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

  if (company === "byteforce") {
    const lists = await todoFor({ brand: "byteforce", scope: { kind: "all" } });
    return <TodoBody lists={lists} apiBase="/api/byteforce" tabs={tabs} />;
  }

  /* ADR-074 — the To-Do is a shared body; the SURFACE decides whose rows. */

  /* ADR-051 + ADR-067 — under ByteForce the company itself proves
     `byteforce_staff` (companiesFor only reports a company a role carries), so
     the role narrowing below applies to the B-SYSTEMS branch: the same four
     pipeline roles this page always accepted, with the data-entry account still
     carved out of it and sent to its one destination. */
  const role = bsRoleOrNull(user);
  const scope: TodoScope =
    role === "bsystems_admin"
      ? { kind: "all" }
      : role === "bsystems_sales"
        ? { kind: "internal" }
        : { kind: "own", userId: user.id };
  const lists = await todoFor({ brand: "bsystems", scope });

  /* Founder — "I can assign these to do as an admin or just take it myself":
     ADMIN ONLY. The roster is the lead-detail page's (agents / partners /
     internal sales — deliberately no admins; "Take it" is the only admin
     path), with the same pre-translated role labels. */
  let rowActions: ((item: TodoItem) => ReactNode) | undefined;
  if (role === "bsystems_admin") {
    const locale = await getLocale();
    const t = tFor(locale);
    const roleLabels: Record<string, Msg> = roleMsgs;
    const assign: TodoAssign = {
      owners: (await listAssignableOwners()).map((o) => ({
        id: o.id,
        name: o.name,
        company: o.company,
        roleLabel: t(
          roleLabels[o.roles.find((r) => roleLabels[r]) ?? ""] ?? roleMsgs.bsystems_agent,
        ),
      })),
      selfUserId: user.id,
      locale,
    };
    rowActions = (item) => <TodoRowActions item={item} assign={assign} />;
  }
  return <TodoBody lists={lists} apiBase="/api/b-systems" rowActions={rowActions} tabs={tabs} />;
}
