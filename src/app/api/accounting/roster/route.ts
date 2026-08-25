import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { createMember, memberSchema } from "@/lib/services/accounting";

/* ADR-052 — the payroll roster. ADMIN ONLY. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = memberSchema.parse(await req.json());
  const row = await createMember(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
