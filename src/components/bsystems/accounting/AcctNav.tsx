import Link from "next/link";
import { tFor, type Locale, type Msg } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { mediaHidden } from "@/lib/accounting/constants";
import { acctQuery, type AcctView } from "@/lib/accounting/params";

/* ADR-052 — the accounting section's tab strip (the SPA's eleven screens +
   Import). Media Buying disappears ENTIRELY under company=bsystems (founder
   decision 5). Links carry the current company+month so the view survives
   navigation. Composed from existing design-system classes only. */

export type AcctTab =
  | "dashboard"
  | "income"
  | "expenses"
  | "clients"
  | "roster"
  | "media"
  | "loans"
  | "treasury"
  | "pnl"
  | "departments"
  | "targets"
  | "import";

const TABS: Array<{ id: AcctTab; href: string; label: Msg }> = [
  { id: "dashboard", href: "/b-systems/accounting", label: acct.tabDashboard },
  { id: "income", href: "/b-systems/accounting/income", label: acct.tabIncome },
  { id: "expenses", href: "/b-systems/accounting/expenses", label: acct.tabExpenses },
  { id: "clients", href: "/b-systems/accounting/clients", label: acct.tabClients },
  { id: "roster", href: "/b-systems/accounting/roster", label: acct.tabRoster },
  { id: "media", href: "/b-systems/accounting/media", label: acct.tabMedia },
  { id: "loans", href: "/b-systems/accounting/loans", label: acct.tabLoans },
  { id: "treasury", href: "/b-systems/accounting/treasury", label: acct.tabTreasury },
  { id: "pnl", href: "/b-systems/accounting/report", label: acct.tabPnl },
  { id: "departments", href: "/b-systems/accounting/departments", label: acct.tabDepartments },
  { id: "targets", href: "/b-systems/accounting/targets", label: acct.tabTargets },
  { id: "import", href: "/b-systems/accounting/import", label: acct.tabImport },
];

export function AcctNav({
  view,
  tab,
  locale,
}: {
  view: AcctView;
  tab: AcctTab;
  locale: Locale;
}) {
  const t = tFor(locale);
  const tabs = TABS.filter((item) => item.id !== "media" || !mediaHidden(view.company));
  return (
    <nav className="card card-pad flex flex-wrap gap-1" aria-label={t(acct.navItem)}>
      {tabs.map((item) => (
        <Link
          key={item.id}
          href={`${item.href}${acctQuery(view)}`}
          className="nav-item"
          aria-current={item.id === tab ? "page" : undefined}
        >
          {t(item.label)}
        </Link>
      ))}
    </nav>
  );
}
