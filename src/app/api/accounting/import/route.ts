import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { importAccounting } from "@/lib/accounting/import";
import { ACCT_COMPANIES, type AcctCompany } from "@/lib/accounting/constants";

/* ADR-052, founder decision 4 — the one-time books import. ADMIN ONLY.
   POST multipart: `file` = the old app's own JSON export (single company or
   the "Export ALL companies" wrapper); `company` = which company a
   single-company file belongs to (ignored for the wrapper). REPLACES that
   company's accounting rows in one transaction and returns the derived
   reconciliation numbers for the manual side-by-side check. */

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAccounting();
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "No export file provided");
  const rawCompany = form.get("company");
  const company: AcctCompany | null =
    typeof rawCompany === "string" && (ACCT_COMPANIES as readonly string[]).includes(rawCompany)
      ? (rawCompany as AcctCompany)
      : null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, "Not a valid accounting export file");
  }
  const summary = await importAccounting(parsed, company, { id: user.id, label: user.name });
  return Response.json({ ok: true, ...summary });
});
