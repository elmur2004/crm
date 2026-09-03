import { handleRoute, requireVault } from "@/lib/auth/guards";
import { assertVaultCompany, vaultCompaniesOf } from "@/lib/services/vault/tenancy";
import { createVaultForm, vaultFormSchema } from "@/lib/services/vault/forms";

/* ADR-053 — vault forms. A duplicate URL answers 409 (the handshake); the
   client re-submits with acknowledgeDuplicate to file it anyway. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const input = vaultFormSchema.parse(await req.json());
  /* ADR-074 — the payload names a company; it must be one this
     account holds (services/vault/tenancy.ts). */
  assertVaultCompany(user, input.company);
  const row = await createVaultForm(input, vaultCompaniesOf(user), { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
