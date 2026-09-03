import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { todoFor } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";

export const metadata = { title: "To-Do — Mindoo" };

/* ADR-074 — Mindoo's To-Do. Founder (ADR-041, ADR-061): everything dated today,
   one plain list.

   The scope is `all` and there are no admin row actions, which is the ByteForce
   shape rather than the B-Systems one, and for the same reason: a single staff
   role that sees the whole company. Assigning a task to somebody is a B-Systems
   subsystem — its roster is B-Systems' agents, partners and internal sales, and
   its endpoint is B-Systems-locked — so it is not offered here, exactly as it
   is not offered to ByteForce. */

export default async function MindooTodoPage() {
  await requireMindooPage();
  const lists = await todoFor({ brand: MINDOO_SURFACE.brand, scope: { kind: "all" } });
  return <TodoBody lists={lists} apiBase={MINDOO_SURFACE.apiBase} />;
}
