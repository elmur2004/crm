import { formatMsg, tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadsExport as m } from "@/lib/i18n/dict/crm";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { leadsExportHref } from "@/lib/crm/leads-export";
import type { CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   ADR-083 — the two export buttons, on the Leads page.

   Founder, verbatim: "add a button to export all leads in an excel sheet / a
   button for bsystems and a button for byteforce", and (asked) on THE LEADS
   PAGE rather than the CRM board.

   A SERVER component, and plain anchors with `download`: no client JavaScript
   at all, so the spreadsheet library never comes near a browser bundle and the
   button works with scripting off. The accounting export set the idiom
   (components/accounting/exporter.tsx) — the server names the file, the browser
   just saves it.

   WHICH BUTTONS RENDER is decided on the SERVER, by the page, from the live
   roles (`leadsExportCompanies`). An account that can reach only one company's
   Leads page is shown only that company's button — and because the route
   refuses the other company from the same predicate, this component can never
   offer a download the server would then refuse. It is navigation, not a wall:
   the wall is lib/api/leads-export-route.ts.

   Each button NAMES its company, because the one mistake that matters here is
   opening the wrong company's customer list.
   ========================================================================== */

export async function LeadsExportButtons({ companies }: { companies: CrmCompany[] }) {
  const locale = await getLocale();
  const t = tFor(locale);
  if (companies.length === 0) return null;
  return (
    <>
      {companies.map((company) => (
        <a
          key={company}
          href={leadsExportHref(company)}
          className="btn-ghost"
          download
          data-export-company={company}
        >
          {t(formatMsg(m.button, { company: t(acctCompanies[company]!) }))}
        </a>
      ))}
      {/* one sentence, not one per button: it says what is IN the file, which is
          the half of his request a button label cannot carry */}
      <span className="u-muted">{t(m.hint)}</span>
    </>
  );
}
