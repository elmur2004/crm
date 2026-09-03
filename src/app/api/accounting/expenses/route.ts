import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { createExpense, expenseSchema } from "@/lib/services/accounting";

/* ADR-052 — accounting expenses. ADMIN ONLY. New rows default to ON HOLD:
   nothing touches cash until approved (the approval gate). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = expenseSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const row = await createExpense(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
