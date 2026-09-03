import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { createIncome, incomeSchema } from "@/lib/services/accounting";

/* ADR-052 — accounting income. ADMIN ONLY (every accounting wall is). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = incomeSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const row = await createIncome(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
