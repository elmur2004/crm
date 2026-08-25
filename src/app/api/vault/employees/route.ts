import { handleRoute, requireVault } from "@/lib/auth/guards";
import { createVaultEmployee, vaultEmployeeSchema } from "@/lib/services/vault/employees";

/* ADR-053 — vault employee cards. ADMIN ONLY (every vault wall is). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const input = vaultEmployeeSchema.parse(await req.json());
  const row = await createVaultEmployee(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
