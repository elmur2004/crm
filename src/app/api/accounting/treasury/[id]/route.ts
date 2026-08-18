import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { deleteMove, moveSchema, updateMove, zCompany } from "@/lib/services/accounting";

/* ADR-052 — one treasury movement: edit, delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireBsAdmin();
  const { id } = await ctx.params;
  const input = moveSchema.parse(await req.json());
  return Response.json(await updateMove(id, input, { id: user.id, label: user.name }));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireBsAdmin();
  const { id } = await ctx.params;
  const company = zCompany.safeParse(new URL(req.url).searchParams.get("company"));
  if (!company.success) throw new ApiError(400, "Unknown company");
  await deleteMove(id, company.data, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
