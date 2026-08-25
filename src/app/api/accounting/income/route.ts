import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { createIncome, incomeSchema } from "@/lib/services/accounting";

/* ADR-052 — accounting income. ADMIN ONLY (every accounting wall is). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = incomeSchema.parse(await req.json());
  const row = await createIncome(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
