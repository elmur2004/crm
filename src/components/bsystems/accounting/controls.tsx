"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct, acctCompanies } from "@/lib/i18n/dict/accounting";
import { ACCT_COMPANIES, type AcctCompany } from "@/lib/accounting/constants";
import { addMonths } from "@/lib/accounting/engine";
import { monthLabel } from "@/lib/accounting/format";

/* ADR-052 — the company switcher (a FILTER, not a tenant) and the month
   picker. Both write URL params so every view is linkable and the server
   renders the truth; design-system classes only. */

function useSetParam() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`);
  };
}

export function AcctControls({
  company,
  month,
  showMonth = true,
}: {
  company: AcctCompany;
  month: string;
  showMonth?: boolean;
}) {
  const t = tFor(useLocale());
  const locale = useLocale();
  const setParam = useSetParam();
  return (
    <div className="page-actions">
      <div className="switcher" role="group" aria-label={t(acct.company)}>
        {ACCT_COMPANIES.map((c) => (
          <button
            key={c}
            type="button"
            className="switcher-seg"
            aria-current={c === company ? "true" : undefined}
            onClick={() => setParam({ company: c })}
          >
            {t(acctCompanies[c]!)}
          </button>
        ))}
      </div>
      {showMonth ? (
        <div className="switcher" role="group" aria-label={t(acct.month)}>
          <button
            type="button"
            className="switcher-seg"
            aria-label={t(acct.prevMonth)}
            onClick={() => setParam({ month: addMonths(month, -1) })}
          >
            ‹
          </button>
          <span className="switcher-seg" aria-current="true">
            {monthLabel(month, locale)}
          </span>
          <button
            type="button"
            className="switcher-seg"
            aria-label={t(acct.nextMonth)}
            onClick={() => setParam({ month: addMonths(month, 1) })}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
