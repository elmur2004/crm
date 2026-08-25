import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { openingSchema, setOpeningBalance } from "@/lib/services/accounting";

/* ADR-052 — per-company accounting settings: the system opening balance. */

export const PUT = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = openingSchema.parse(await req.json());
  const row = await setOpeningBalance(input, { id: user.id, label: user.name });
  return Response.json(row);
});
