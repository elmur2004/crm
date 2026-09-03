import { handleRoute, requireAccounting } from "@/lib/auth/guards";
import { ApiError } from "@/lib/api-error";
import { importAccounting } from "@/lib/accounting/import";
import { type AcctCompany } from "@/lib/accounting/constants";
import { acctCompaniesOf, acctCompanyOf } from "@/lib/accounting/tenancy";

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
  /* ADR-074 — a single-company file is written into a company this account
     HOLDS, or into none at all. Unheld 404s (tenancy.ts); absent stays null,
     which is the wrapper case the parser handles. */
  const rawCompany = form.get("company");
  const company: AcctCompany | null =
    typeof rawCompany === "string" && rawCompany !== "" ? acctCompanyOf(user, rawCompany) : null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new ApiError(400, "Not a valid accounting export file");
  }
  /* and a WRAPPER file names its own companies inside — every one of them
     must be this account's too, or an upload would replace another company's
     books wholesale. */
  const summary = await importAccounting(parsed, company, acctCompaniesOf(user), {
    id: user.id,
    label: user.name,
  });
  return Response.json({ ok: true, ...summary });
});
