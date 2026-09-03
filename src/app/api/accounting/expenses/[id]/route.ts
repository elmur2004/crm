import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { acctCompanyOf, assertAcctCompany } from "@/lib/accounting/tenancy";
import {
  deleteExpense,
  expenseSchema,
  toggleExpensePaid,
  updateExpense,
} from "@/lib/services/accounting";

/* ADR-052 — one expense row: edit, approve / put back on hold, delete. */

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const body = (await req.json()) as Record<string, unknown>;
  const actor = { id: user.id, label: user.name };
  if (body["togglePaid"] === true) {
    const company = acctCompanyOf(user, body["company"]);
    return Response.json(await toggleExpensePaid(id, company, actor));
  }
  const input = expenseSchema.parse(body);
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  return Response.json(await updateExpense(id, input, actor));
});

export const DELETE = handleRoute(async (req: Request, ctx: Ctx) => {
  const user = await requireAccounting();
  const { id } = await ctx.params;
  const company = acctCompanyOf(user, new URL(req.url).searchParams.get("company"));
  await deleteExpense(id, company, { id: user.id, label: user.name });
  return Response.json({ ok: true });
});
