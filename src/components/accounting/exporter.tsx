"use client";

import { useSearchParams } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct, acctCompanies } from "@/lib/i18n/dict/accounting";
import { acctView } from "@/lib/accounting/params";

/* ADR-054, founder directives B + C — the Export control beside Import. Two
   downloads, both the ORIGINAL SPA's own JSON shapes (its DataMenu): the
   current company's single-company file and the all-companies wrapper. Plain
   anchors to the admin-only GET — the server sets the SPA's exact filename. */

export function ExportPanel() {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const view = acctView({
    company: params.get("company") ?? undefined,
    month: params.get("month") ?? undefined,
  });
  return (
    <section className="card card-pad space-y-3 max-w-2xl">
      <h2 className="u-h3">{t(acct.exportTitle)}</h2>
      <p className="u-muted">{t(acct.exportSub)}</p>
      <div className="flex flex-wrap gap-3">
        <a href={`/api/accounting/export?company=${view.company}`} className="btn-primary" download>
          {t(acct.exportCompany)} — {t(acctCompanies[view.company]!)}
        </a>
        <a href="/api/accounting/export?all=1" className="btn-ghost" download>
          {t(acct.exportAll)}
        </a>
      </div>
    </section>
  );
}
