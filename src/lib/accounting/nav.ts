import type { Msg } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { mediaHidden, type AcctCompany } from "./constants";

/* ADR-054 — the accounting module's OWN menu: the SPA's eleven screens +
   Import. Pure (no React), so the one-way-in guard (lib/launcher/menus.ts)
   reads the very list AcctModuleNav renders.

   One way to each page: the accounting dashboard, the monthly P&L and the
   department profitability live HERE and nowhere else — founder: "Inside
   Accounting only" (they left the Reports & Dashboards list). */

export interface AcctNavItem {
  href: string;
  label: Msg;
}

export const ACCOUNTING_SECTIONS: readonly AcctNavItem[] = [
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

/** The menu under one company's books. Founder decision 5 — B-Systems hides
    the Media Buying tab; ADR-080 left that the only rule that varies. */
export function accountingNavFor(company: AcctCompany): AcctNavItem[] {
  return ACCOUNTING_SECTIONS.filter((s) => s.href !== "/accounting/media" || !mediaHidden(company));
}
