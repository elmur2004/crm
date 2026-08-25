import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { addLoanPayment, loanPaymentSchema } from "@/lib/services/accounting";

/* ADR-052 — record a repayment (borrowed) or collection (lent) on one loan,
   optionally moving the cash through treasury. */

export const POST = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAccounting();
    const { id } = await ctx.params;
    const input = loanPaymentSchema.parse(await req.json());
    const row = await addLoanPayment(id, input, { id: user.id, label: user.name });
    return Response.json(row, { status: 201 });
  },
);
