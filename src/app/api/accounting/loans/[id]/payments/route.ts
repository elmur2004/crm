import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { addLoanPayment, loanPaymentSchema } from "@/lib/services/accounting";

/* ADR-052 — record a repayment (borrowed) or collection (lent) on one loan,
   optionally moving the cash through treasury. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAccounting();
    const { id } = await ctx.params;
    const input = loanPaymentSchema.parse(await req.json());
    /* ADR-074 — the payload names a company; it must be one of THIS
       account's (see lib/accounting/tenancy.ts). */
    assertAcctCompany(user, input.company);
    const row = await addLoanPayment(id, input, { id: user.id, label: user.name });
    return Response.json(row, { status: 201 });
  },
);
