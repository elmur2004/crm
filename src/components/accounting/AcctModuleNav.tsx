"use client";

import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { tFor, type Msg } from "@/lib/i18n/core";
import { useLocale } from "@/components/shared/LocaleProvider";
import { acct } from "@/lib/i18n/dict/accounting";
import { mediaHidden } from "@/lib/accounting/constants";
import { hasAcctSection } from "@/lib/module-sections";
import { acctQuery, acctView } from "@/lib/accounting/params";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* ADR-054 — the accounting module's OWN header nav: the SPA's eleven screens +
   Import, in the app shell (the module is a switcher peer now, so its sections
   live where every app's sections live). Client-side because the links must
   carry the current ?company=&month= view — the layout is a server component
   and cannot read searchParams. Media Buying disappears ENTIRELY under
   company=bsystems (founder decision 5). Composes ShellNav — never a fork. */

const SECTIONS: Array<{ href: string; label: Msg }> = [
  { href: "/accounting", label: acct.tabDashboard },
  { href: "/accounting/income", label: acct.tabIncome },
  { href: "/accounting/expenses", label: acct.tabExpenses },
  { href: "/accounting/clients", label: acct.tabClients },
  { href: "/accounting/roster", label: acct.tabRoster },
  { href: "/accounting/media", label: acct.tabMedia },
  { href: "/accounting/loans", label: acct.tabLoans },
  { href: "/accounting/treasury", label: acct.tabTreasury },
  { href: "/accounting/report", label: acct.tabPnl },
  { href: "/accounting/departments", label: acct.tabDepartments },
  { href: "/accounting/targets", label: acct.tabTargets },
  { href: "/accounting/import", label: acct.tabImport },
];

export function AcctModuleNav({
  companies,
  extras,
}: {
  /* ADR-074 — the companies THIS ACCOUNT holds, handed down from the server.
     A client component cannot ask (it has only the URL and the roles are not in
     it), and it must never assume the module-level list: with Mindoo on the
     platform, assuming would mean a B-Systems admin's tabs quietly gaining
     another company's books. */
  companies: Brand[];
  extras?: React.ReactNode;
}) {
  const t = tFor(useLocale());
  const params = useSearchParams();
  const view = acctView(
    {
      company: params.get("company") ?? undefined,
      month: params.get("month") ?? undefined,
    },
    companies,
  );
  /* ADR-076 — the sections THIS COMPANY has. Founder: "for mindoo and only
     mindoo — accounting should only be : dashborad income expenses clients
     loans tresury and import export". B-Systems and ByteForce fall through to
     the full list, so this can only ever subtract.

     `mediaHidden` stays beside it rather than being folded in: it is founder
     decision 5 about ONE tab under ONE company, and collapsing two different
     rules into one table would lose why each exists. */
  const items = SECTIONS.filter(
    (s) => hasAcctSection(view.company, s.href) && (s.href !== "/accounting/media" || !mediaHidden(view.company)),
  ).map((s) => ({ href: `${s.href}${acctQuery(view)}`, label: t(s.label) }));
  return <ShellNav items={items} extras={extras} />;
}
