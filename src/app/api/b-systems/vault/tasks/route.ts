import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createVaultTask, vaultTaskSchema } from "@/lib/services/vault/tasks";

/* ADR-053 — create a task (assignee card + name + calendar-date deadline). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = vaultTaskSchema.parse(await req.json());
  const row = await createVaultTask(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
