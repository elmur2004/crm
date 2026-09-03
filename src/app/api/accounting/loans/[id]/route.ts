import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf } from "@/lib/accounting/tenancy";
import { deleteLoan } from "@/lib/services/accounting";

/* ADR-052 — delete one loan (payments cascade). */

export const DELETE = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAccounting();
    const { id } = await ctx.params;
    const company = acctCompanyOf(user, new URL(req.url).searchParams.get("company"));
    await deleteLoan(id, company, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
