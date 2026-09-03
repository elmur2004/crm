import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany, vaultCompaniesOf } from "@/lib/services/vault/tenancy";
import { createVaultTask, vaultTaskSchema } from "@/lib/services/vault/tasks";

/* ADR-053 — create a task (assignee card + name + calendar-date deadline). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const input = vaultTaskSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one this
     account holds (services/vault/tenancy.ts). */
  assertVaultCompany(user, input.company);
  const row = await createVaultTask(input, vaultCompaniesOf(user), { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
