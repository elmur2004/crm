import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { deleteLoan, zCompany } from "@/lib/services/accounting";

/* ADR-052 — delete one loan (payments cascade). */

export const DELETE = handleRoute(
  async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
    const user = await requireBsAdmin();
    const { id } = await ctx.params;
    const company = zCompany.safeParse(new URL(req.url).searchParams.get("company"));
    if (!company.success) throw new ApiError(400, "Unknown company");
    await deleteLoan(id, company.data, { id: user.id, label: user.name });
    return Response.json({ ok: true });
  },
);
