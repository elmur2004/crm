import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { openingSchema, setOpeningBalance } from "@/lib/services/accounting";

/* ADR-052 — per-company accounting settings: the system opening balance. */

export const PUT = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = openingSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const row = await setOpeningBalance(input, { id: user.id, label: user.name });
  return Response.json(row);
});
