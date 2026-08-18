import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createMove, moveSchema } from "@/lib/services/accounting";

/* ADR-052 — treasury deposits / withdrawals. ADMIN ONLY. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = moveSchema.parse(await req.json());
  const row = await createMove(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
