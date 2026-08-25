import { handleRoute, requireVault } from "@/lib/auth/guards";
import { exportVault } from "@/lib/services/vault/backup";

/* ADR-054, founder directive B — the vault module's own export. ADMIN ONLY.
   GET → the module-scoped backup: the five Vault* tables, the vault-owned
   Attachment rows, and their files as base64 (the global backup pattern,
   vault-only). Logged to ActivityLog. */

export const GET = handleRoute(async () => {
  const user = await requireVault();
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
