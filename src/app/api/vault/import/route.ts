import { handleRoute, requireVault } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { importVault } from "@/lib/services/vault/backup";
import { seesUntagged, vaultCompaniesOf } from "@/lib/services/vault/tenancy";

/* ADR-054, founder directive B — the vault module's own import. ADMIN ONLY.
   POST multipart `export` = a vault export file. REPLACES the vault's rows
   and files atomically (rows in one transaction, blobs after commit), logs
   to ActivityLog, and consumes pending undo entries (destructive). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireVault();
  /* ADR-074 — the vault backup is WHOLE-MODULE: it exports and (on import)
     REPLACES every row of every company at once. There is no per-company shape
     for it and inventing one here would be a new file format nobody asked for,
     so it stays with the account that owns the whole module — the one that can
     see the untagged rows (services/vault/tenancy.ts). A Mindoo account is
     refused rather than handed another company's entire vault.
     404, not 403: the same ruling as everywhere else in this module. */
  if (!seesUntagged(vaultCompaniesOf(user))) throw new ApiError(404, "Not found");
  const form = await req.formData();
  const file = form.get("export");
  if (!(file instanceof File)) throw new ApiError(400, "No vault export file provided");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, "Not a valid vault export file for this system");
  }
  const counts = await importVault(parsed, { id: user.id, label: user.name });
  return Response.json({ ok: true, counts });
});
