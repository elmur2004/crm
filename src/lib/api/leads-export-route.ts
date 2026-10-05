import { ApiError, handleRoute, requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { writeLog } from "@/lib/services/activity";
import { getLocale } from "@/lib/i18n/server";
import { canExportLeads } from "@/lib/crm/leads-export";
import { buildLeadsWorkbook } from "@/lib/services/leads-export";
import type { CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   ADR-083 — THE LEADS EXPORT ROUTE, parameterized by company.

   ONE handler, mounted TWICE — /api/byteforce/leads/export and
   /api/b-systems/leads/export — because ADR-067's wall is that the brand comes
   from the ROUTE and never from input. There is deliberately no `?company=` on
   either endpoint: a company parameter here would be the one way to widen this
   across companies, and this is the single request in the product that returns
   an entire company's customer list in one file.

   THE WALL, stated plainly. It is the LEADS PAGE's own, unchanged and not one
   role looser — ByteForce needs `byteforce_staff`, B-Systems needs
   `bsystems_admin`, and `canExportLeads` is the same predicate the two buttons
   are rendered from (lib/crm/leads-export.ts). So:

     · `bsystems_sales` is refused: internal sales works the internal bucket and
       cannot open the admin Leads page, so it cannot have the admin's book.
     · `bsystems_agent` / `bsystems_partner` are refused: they see only their own
       leads anywhere in this product (requireLeadAccess), and a company-wide
       file would undo that in one click. This is the refusal the feature exists
       to get right.
     · `bsystems_data_entry` is refused twice over — carved out of the pipeline
       roles (ADR-051), and not the admin.
     · a ByteForce-only account typing the B-Systems URL by hand is refused, and
       so is the reverse. The company is the route, so there is no value to type.

   ONE decision, in one place: `canExportLeads` already asks both halves (does
   this account hold the company at all, and does it hold the role that company's
   Leads page demands), so there is no second role list here to drift from it.
   The 403's words are `assertRole`'s own, so a refusal reads like every other
   refusal in this API.

   Enforced HERE, from the session, against roles re-read from the database on
   every request (ADR-017 — `requireUser`), never from anything the client
   sends. The buttons are navigation; this is the boundary.
   ========================================================================== */

export function leadsExportRoute(company: CrmCompany) {
  return handleRoute(async () => {
    /* authenticate FIRST — an anonymous caller is 401 before any role work and
       before a single row is read */
    const user = await requireUser();
    if (!canExportLeads(user.roles, company)) {
      throw new ApiError(403, "You do not have access to this area");
    }

    const locale = await getLocale();
    const { buffer, filename, rows } = await buildLeadsWorkbook(company, locale);

    /* Logged like the books export (ADR-054): entityId is the COMPANY, because
       the subject of the event is the company's whole book, not any one lead. */
    await db.$transaction(async (tx) => {
      await writeLog(tx, {
        entityType: "lead_export",
        entityId: company,
        actor: { id: user.id, label: user.name },
        action: "export",
        trigger: "leads_export",
      });
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        /* the row count, so a caller (and the e2e spec) can tell the file is the
           whole book without unzipping it first */
        "X-Lead-Rows": String(rows),
        "Cache-Control": "no-store",
      },
    });
  });
}
