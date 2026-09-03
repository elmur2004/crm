import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { assertAcctCompany } from "@/lib/accounting/tenancy";
import { payrollMarkSchema, togglePayrollMark } from "@/lib/services/accounting";

/* ADR-052 — approve / un-approve ONE person-month of DERIVED payroll (the
   SPA's payrollPaid map). The salary row itself never exists in the DB. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const input = payrollMarkSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one of THIS
     account's (see lib/accounting/tenancy.ts). */
  assertAcctCompany(user, input.company);
  const result = await togglePayrollMark(input, { id: user.id, label: user.name });
  return Response.json(result);
});
