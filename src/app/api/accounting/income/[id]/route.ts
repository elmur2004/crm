import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import {
  deleteIncome,
  incomeSchema,
  toggleIncomeCollected,
  updateIncome,
  zCompany,
} from "@/lib/services/accounting";

/* ADR-052 — one income row: edit, toggle collection (the ✓), delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireBsAdmin();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const actor = { id: user.id, label: user.name };
  if (body["toggleCollected"] === true) {
    const company = zCompany.parse(body["company"]);
    return Response.json(await toggleIncomeCollected(id, company, actor));
  }
  const input = incomeSchema.parse(body);
  return Response.json(await updateIncome(id, input, actor));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireBsAdmin();
  const { id } = await ctx.params;
  const company = zCompany.safeParse(new URL(req.url).searchParams.get("company"));
  if (!company.success) throw new ApiError(400, "Unknown company");
  await deleteIncome(id, company.data, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
