import Link from "next/link";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { shell } from "@/lib/i18n/dict/auth";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { crmQuery, type CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   THE TO-DO's COMPANY TABS — a filter on the same page, not a way to another.

   One way to each page (founder: "two CRM icons, no switch"): the company
   switch left the shell. The To-Do is ONE launcher app with ONE page, though,
   and an account that works leads in both companies has a day in each — so
   the page itself offers the two companies as tabs. Same path, a different
   `?company=`: RoutePending keeps the page on screen (a same-path change), and
   no menu gains an item.

   Rendered only for two or more companies (the caller decides, from
   workingCompaniesFor — the same predicate that decides which company the
   To-Do tile opens). The companies come from the SERVER: a company this
   account does not hold has no tab, and the page guard refuses it anyway.

   It names the company you are on IN WORDS beside the tabs, so the current one
   never rides on the active pill alone (ADR-067's "no confusion in it"), and
   marks the active tab with aria-current on top of that. */

/** Reading order of the tabs: the launcher's own (ByteForce CRM, then
    B-Systems CRM). */
const TAB_ORDER: readonly CrmCompany[] = ["byteforce", "bsystems"];

export async function CompanyTabs({
  path,
  current,
  companies,
}: {
  /** this page's own address — the tabs only swap its company */
  path: string;
  current: CrmCompany;
  companies: readonly CrmCompany[];
}) {
  if (companies.length < 2) return null;
  const t = tFor(await getLocale());
  const tabs = TAB_ORDER.filter((c) => companies.includes(c));
  return (
    <div className="company-tabs">
      {/* the label STATES the company; the tabs only offer the other one */}
      <p className="company-tabs-label">
        {t(shell.companyLabel)}
        <span aria-hidden> · </span>
        <span className="company-tabs-current">{t(acctCompanies[current]!)}</span>
      </p>
      <div className="switcher" role="group" aria-label={t(shell.companyLabel)}>
        {tabs.map((company) => (
          <Link
            key={company}
            href={`${path}${crmQuery(company)}`}
            className="switcher-seg"
            aria-current={company === current ? "true" : undefined}
          >
            <span className="switcher-label">{t(acctCompanies[company]!)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
