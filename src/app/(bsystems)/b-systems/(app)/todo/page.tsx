import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { todoFor, type TodoScope } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";

export const metadata = { title: "To-Do — B-Systems CRM" };

/* Founder (ADR-041) — everything dated today (and overdue), one plain list.
   Scope mirrors requireLeadAccess: admin all, sales internal bucket,
   agents/partners their own leads; partnership/statement/milestone rows are
   admin-only. */

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
  return <TodoBody lists={lists} />;
}
