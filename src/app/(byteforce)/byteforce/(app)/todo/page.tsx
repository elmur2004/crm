import { requirePageRole } from "@/lib/auth/page-guards";
import { todoFor } from "@/lib/services/todo";
import { TodoBody } from "@/components/shared/TodoBody";

export const metadata = { title: "To-Do — ByteForce CRM" };

/* Founder (ADR-041) — same plain daily list for ByteForce staff (all
   byteforce leads; the B-Systems-only subsystems don't apply here). */

export default async function ByteforceTodoPage() {
  await requirePageRole("/login", "byteforce_staff");
  const lists = await todoFor({ brand: "byteforce", scope: { kind: "all" } });
  return <TodoBody lists={lists} apiBase="/api/byteforce" />;
}
