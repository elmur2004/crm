import { ApiError, handleRoute, requireUser } from "@/lib/auth/guards";
import { getLocale } from "@/lib/i18n/server";
import { MAX_IMPORT_BYTES, canImportLeads } from "@/lib/crm/leads-import";
import {
  ImportFileError,
  buildImportTemplate,
  fileError,
  importLeads,
} from "@/lib/services/leads-import";
import type { CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   IMPORT LEADS FROM EXCEL — the two routes, parameterised by company.

   The export's shape (ADR-083), mirrored: ONE handler per action, mounted once
   per company — /api/{byteforce|b-systems}/leads/import (POST the filled file)
   and …/import/template (GET the blank one) — with the company a FUNCTION
   ARGUMENT the route files hardcode. ADR-067's wall: there is no `?company=`
   to type, so a ByteForce-only account cannot import into B-Systems by editing
   a URL, and the reverse.

   THE WALL is `canImportLeads`, the same predicate the button is rendered
   from: can open that company's Leads page AND may create leads there. In
   practice ByteForce → byteforce_staff, B-Systems → bsystems_admin. Enforced
   HERE, from the session, against roles re-read from the database on every
   request (ADR-017's `requireUser`) — the button is navigation, this is the
   boundary. Authentication comes first, so an anonymous caller is 401 before a
   byte of the upload is read; a refused caller is 403 before it is read either.
   ========================================================================== */

/** The upload ceiling plus room for the multipart envelope around it. */
const MAX_REQUEST_BYTES = MAX_IMPORT_BYTES + 64 * 1024;

async function authorise(company: CrmCompany) {
  const user = await requireUser();
  if (!canImportLeads(user.roles, company)) {
    throw new ApiError(403, "You do not have access to this area");
  }
  return user;
}

const refused = (err: ImportFileError) =>
  Response.json(err.body, { status: err.status, headers: { "Cache-Control": "no-store" } });

export function leadsImportRoute(company: CrmCompany) {
  return handleRoute(async (req: Request) => {
    const user = await authorise(company);

    /* refuse an oversized body from its declaration, before buffering it */
    const declared = Number(req.headers.get("content-length") ?? "0");
    if (declared > MAX_REQUEST_BYTES) return refused(fileError(company, 413, "too_large"));

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return refused(fileError(company, 400, "no_file"));
    }
    const file = form.get("file");
    if (!file || typeof file === "string") return refused(fileError(company, 400, "no_file"));
    /* ".xlsx only" — by name here, and by the zip signature in the service, so
       neither a renamed CSV nor a legacy .xls gets as far as the parser */
    if (!/\.xlsx$/i.test(file.name)) return refused(fileError(company, 400, "not_xlsx"));
    if (file.size > MAX_IMPORT_BYTES) return refused(fileError(company, 413, "too_large"));

    try {
      const result = await importLeads(
        company,
        Buffer.from(await file.arrayBuffer()),
        { id: user.id, label: user.name },
        { locale: await getLocale() },
      );
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      if (err instanceof ImportFileError) return refused(err);
      throw err;
    }
  });
}

export function leadsImportTemplateRoute(company: CrmCompany) {
  return handleRoute(async () => {
    await authorise(company);
    const { buffer, filename } = await buildImportTemplate(company);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
