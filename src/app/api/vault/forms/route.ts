import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { createVaultForm, vaultFormSchema } from "@/lib/services/vault/forms";

/* ADR-053 — vault forms. A duplicate URL answers 409 (the handshake); the
   client re-submits with acknowledgeDuplicate to file it anyway. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const input = vaultFormSchema.parse(await req.json());
  const row = await createVaultForm(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
