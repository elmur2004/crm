import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf } from "@/lib/accounting/tenancy";
import { deleteTarget } from "@/lib/services/accounting";

/* ADR-052 — remove one monthly target. */

export const DELETE = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireAccounting();
    const { id } = await ctx.params;
    const company = acctCompanyOf(user, new URL(req.url).searchParams.get("company"));
    await deleteTarget(id, company, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
