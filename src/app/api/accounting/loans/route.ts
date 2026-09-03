import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { createLoan, loanSchema } from "@/lib/services/accounting";

/* ADR-052 — loans. A loan is never income/expense: only cash (an optional
   tagged treasury move) and the balance owed change. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = loanSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const row = await createLoan(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
