import { handleRoute, requireVault } from "@/lib/auth/guards";
import { createVaultLink, vaultLinkSchema } from "@/lib/services/vault/links";

/* ADR-070 — the vault LINKS section. Behind requireVault(), the same wall as
   every other route in this namespace: an admin blocked from the Data Vault
   (ADR-066) is refused here too, by the route and not by the interface.

   The URL is untrusted input and is validated HERE, server-side: `zHttpUrl`
   accepts http and https only, so javascript:, data: and a scheme-relative
   //host never reach the database whatever the browser was told. A duplicate
   URL answers 409 (the handshake); the client re-submits with
   acknowledgeDuplicate to file it anyway. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  const input = vaultLinkSchema.parse(await req.json());
  const row = await createVaultLink(input, { id: user.id, label: user.name });
  return Response.json(row, { status: 201 });
});
