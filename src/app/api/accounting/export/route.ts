import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { writeLog } from "@/lib/services/activity";
import {
  exportAllDoc,
  exportAllFilename,
  exportCompanyDoc,
  exportFilename,
} from "@/lib/accounting/export";
import { ACCT_COMPANIES, type AcctCompany } from "@/lib/accounting/constants";

/* ADR-054, founder directives B + C — the books export. ADMIN ONLY.
   GET ?company=byteforce|bsystems → that company's books in the ORIGINAL
   SPA's single-company shape; GET ?all=1 → the two-company "Export ALL"
   wrapper. Filenames are the SPA's own. Logged to ActivityLog. */

export const GET = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const url = new URL(req.url);
  const all = url.searchParams.get("all");
  const rawCompany = url.searchParams.get("company");

  let payload: unknown;
  let filename: string;
  let entityId: string;
  if (all === "1" || all === "true") {
    payload = await exportAllDoc();
    filename = exportAllFilename();
    entityId = "all";
  } else if (rawCompany && (ACCT_COMPANIES as readonly string[]).includes(rawCompany)) {
    payload = await exportCompanyDoc(rawCompany as AcctCompany);
    filename = exportFilename(rawCompany as AcctCompany);
    entityId = rawCompany;
  } else {
    throw new ApiError(400, "Choose a company to export, or export all companies");
  }

  await db.$transaction(async (tx) => {
    await writeLog(tx, {
      entityType: "acct_books",
      entityId,
      actor: { id: user.id, label: user.name },
      action: "export",
      trigger: "acct_export",
    });
  });

  /* the SPA writes pretty-printed JSON (JSON.stringify(..., null, 2)) */
  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
