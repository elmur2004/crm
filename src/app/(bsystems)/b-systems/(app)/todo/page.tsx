import type { ReactNode } from "react";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { todoFor, type TodoItem, type TodoScope } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";
import { TodoRowActions, type TodoAssign } from "@/components/bsystems/TodoRowActions";
import { listAssignableOwners } from "@/lib/services/users";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";

export const metadata = { title: "To-Do — B-Systems CRM" };

/* Founder (ADR-041, ADR-061) — everything dated today, one plain list (the
   Overdue section and the partnership rows are gone by his instruction).
   Scope mirrors requireLeadAccess: admin all, sales internal bucket,
   agents/partners their own leads; statement/milestone rows are admin-only. */

export default async function BsTodoPage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  const role = bsRoleOf(user);
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
  return <TodoBody lists={lists} apiBase="/api/b-systems" rowActions={rowActions} />;
}
