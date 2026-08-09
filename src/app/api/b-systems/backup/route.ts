import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { exportBackup, importBackup } from "@/lib/services/backup";

/* Full-system backup (founder directive) — ADMIN ONLY.
   GET  → downloads the complete system state as one JSON file (incl. uploads).
   POST → REPLACES all data with an uploaded backup file. */

export const GET = handleRoute(async () => {
  await requireBsAdmin();
  const payload = await exportBackup();
  const stamp = payload.exportedAt.slice(0, 10);
  return new Response(JSON.stringify(payload), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sales-platform-backup-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
});

export const POST = handleRoute(async (req: Request) => {
  const user = await requireBsAdmin();
  const form = await req.formData();
  const file = form.get("backup");
  if (!(file instanceof File)) throw new ApiError(400, "No backup file provided");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, "Not a valid backup file for this system");
  }
  const counts = await importBackup(parsed, { id: user.id, label: user.name });
  return Response.json({ ok: true, counts });
});
