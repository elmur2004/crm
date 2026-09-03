"use client";

import { useSearchParams } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct, acctCompanies } from "@/lib/i18n/dict/accounting";
import { acctView } from "@/lib/accounting/params";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-054, founder directives B + C — the Export control beside Import. Two
   downloads, both the ORIGINAL SPA's own JSON shapes (its DataMenu): the
   current company's single-company file and the all-companies wrapper. Plain
   anchors to the admin-only GET — the server sets the SPA's exact filename. */

export function ExportPanel({ companies }: { companies: Brand[] }) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const view = acctView(
    {
      company: params.get("company") ?? undefined,
      month: params.get("month") ?? undefined,
    },
    companies,
  );
  /* founder: one Export button, like the original — the all-companies file is
     the complete export, reimportable anywhere.
     ADR-074 — "all companies" now means ALL THE COMPANIES THIS ACCOUNT HOLDS,
     and the server decides that from the live roles rather than trusting this
     link; the button is unchanged and the file a B-Systems admin downloads is
     byte-for-byte the two-company wrapper he has always had. */
  void view;
  void acctCompanies;
  void companies;
  return (
    <section className="card card-pad space-y-3 max-w-2xl">
      <div className="flex items-center gap-3 flex-wrap">
        <a href="/api/accounting/export?all=1" className="btn-ghost" download>
          {t(acct.exportAll)}
        </a>
        <span className="u-muted">{t(acct.exportSub)}</span>
      </div>
    </section>
  );
}
