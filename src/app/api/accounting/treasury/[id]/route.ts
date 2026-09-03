import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf, assertAcctCompany } from "@/lib/accounting/tenancy";
import { deleteMove, moveSchema, updateMove } from "@/lib/services/accounting";

/* ADR-052 — one treasury movement: edit, delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const input = moveSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  return Response.json(await updateMove(id, input, { id: user.id, label: user.name }));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const company = acctCompanyOf(user, new URL(req.url).searchParams.get("company"));
  await deleteMove(id, company, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
