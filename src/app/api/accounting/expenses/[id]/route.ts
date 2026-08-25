import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import {
  deleteExpense,
  expenseSchema,
  toggleExpensePaid,
  updateExpense,
  zCompany,
} from "@/lib/services/accounting";

/* ADR-052 — one expense row: edit, approve / put back on hold, delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const actor = { id: user.id, label: user.name };
  if (body["togglePaid"] === true) {
    const company = zCompany.parse(body["company"]);
    return Response.json(await toggleExpensePaid(id, company, actor));
  }
  const input = expenseSchema.parse(body);
  return Response.json(await updateExpense(id, input, actor));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const company = zCompany.safeParse(new URL(req.url).searchParams.get("company"));
  if (!company.success) throw new ApiError(400, "Unknown company");
  await deleteExpense(id, company.data, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
