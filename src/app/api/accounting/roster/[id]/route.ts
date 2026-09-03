import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf, assertAcctCompany } from "@/lib/accounting/tenancy";
import {
  deleteMember,
  memberSchema,
  toggleMemberActive,
  updateMember,
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
    const company = acctCompanyOf(user, body["company"]);
    await toggleMemberActive(id, company, actor);
    return Response.json({ ok: true });
  }
  const input = memberSchema.parse(body);
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  return Response.json(await updateMember(id, input, actor));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const company = acctCompanyOf(user, new URL(req.url).searchParams.get("company"));
  await deleteMember(id, company, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
