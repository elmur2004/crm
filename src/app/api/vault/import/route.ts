import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { importVault } from "@/lib/services/vault/backup";

/* ADR-054, founder directive B — the vault module's own import. ADMIN ONLY.
   POST multipart `export` = a vault export file. REPLACES the vault's rows
   and files atomically (rows in one transaction, blobs after commit), logs
   to ActivityLog, and consumes pending undo entries (destructive). */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
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
