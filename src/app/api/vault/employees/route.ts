import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany } from "@/lib/services/vault/tenancy";
import { createVaultEmployee, vaultEmployeeSchema } from "@/lib/services/vault/employees";

/* ADR-053 — vault employee cards. ADMIN ONLY (every vault wall is). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const input = vaultEmployeeSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one this
     account holds (services/vault/tenancy.ts). */
  assertVaultCompany(user, input.company);
  const row = await createVaultEmployee(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
