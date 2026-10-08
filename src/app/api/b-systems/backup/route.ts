import { handleRoute, requireBsAdmin } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { exportBackup, importBackup } from "@/lib/services/backup";

/* Full-system backup (founder directive) — ADMIN ONLY.
   GET  → downloads the complete system state as one JSON file (incl. uploads).
   POST → REPLACES all data with an uploaded backup file. */

export const GET = handleRoute(async (req: Request) => {
  await requireBsAdmin();
  /* ADR-084 — the per-lead log is IN by default, because asking for it in the
     export is exactly what the founder asked for. `?log=0` leaves it out: it is
     roughly half the file's bytes, and the one file that rebuilds the company
     must stay producible however large its history grows. Nothing else changes —
     `tables` is identical either way, so both files restore the same. */
  const includeLeadLogs = new URL(req.url).searchParams.get("log") !== "0";
  const payload = await exportBackup({ includeLeadLogs });
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
