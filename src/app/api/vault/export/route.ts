import { handleRoute, requireVault } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { exportVault } from "@/lib/services/vault/backup";
import { seesUntagged, vaultCompaniesOf } from "@/lib/services/vault/tenancy";

/* ADR-054, founder directive B — the vault module's own export. ADMIN ONLY.
   GET → the module-scoped backup: the five Vault* tables, the vault-owned
   Attachment rows, and their files as base64 (the global backup pattern,
   vault-only). Logged to ActivityLog. */

export const GET = handleRoute(async () => {
  const user = await requireVault();
  /* ADR-074 — the vault backup is WHOLE-MODULE: it exports and (on import)
     REPLACES every row of every company at once. There is no per-company shape
     for it and inventing one here would be a new file format nobody asked for,
     so it stays with the account that owns the whole module — the one that can
     see the untagged rows (services/vault/tenancy.ts). A Mindoo account is
     refused rather than handed another company's entire vault.
     404, not 403: the same ruling as everywhere else in this module. */
  if (!seesUntagged(vaultCompaniesOf(user))) throw new ApiError(404, "Not found");
  const payload = await exportVault({ id: user.id, label: user.name });
  const stamp = payload.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="vault-export-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});
