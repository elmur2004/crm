import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { setTarget, targetSchema } from "@/lib/services/accounting";

/* ADR-052 — monthly collected-income targets (one per company+month). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = targetSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const row = await setTarget(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
