import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import {
  deleteMember,
  memberSchema,
  toggleMemberActive,
  updateMember,
  zCompany,
} from "@/lib/services/accounting";

/* ADR-052 — one roster member: effective-dated edit (salary/active apply from
   the chosen month FORWARD), active toggle from this month, delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const actor = { id: user.id, label: user.name };
  if (body["toggleActive"] === true) {
    const company = zCompany.parse(body["company"]);
    await toggleMemberActive(id, company, actor);
    return Response.json({ ok: true });
  }
  const input = memberSchema.parse(body);
  return Response.json(await updateMember(id, input, actor));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const company = zCompany.safeParse(new URL(req.url).searchParams.get("company"));
  if (!company.success) throw new ApiError(400, "Unknown company");
  await deleteMember(id, company.data, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
