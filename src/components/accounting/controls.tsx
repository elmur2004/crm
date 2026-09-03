"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { tFor } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct, acctCompanies } from "@/lib/i18n/dict/accounting";
import { type AcctCompany } from "@/lib/accounting/constants";
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
  companies,
  month,
  showMonth = true,
}: {
  company: AcctCompany;
  /* ADR-074 — the companies THIS ACCOUNT may switch between, resolved on the
     server from its live roles. It was the module-level ACCT_COMPANIES, which
     is the whole platform: with a third company on it that constant would have
     offered a B-Systems admin a Mindoo tab and Mindoo's staff two tabs that are
     not its business. The switch can only ever offer what the server sent. */
  companies: readonly AcctCompany[];
  month: string;
  showMonth?: boolean;
}) {
  const t = tFor(useLocale());
  const locale = useLocale();
  const setParam = useSetParam();
  return (
    <div className="page-actions">
      <div className="switcher" role="group" aria-label={t(acct.company)}>
        {companies.map((c) => (
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
