"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale } from "@/components/shared/LocaleProvider";
import { tFor } from "@/lib/i18n/core";
import { shell } from "@/lib/i18n/dict/auth";
import { acctCompanies } from "@/lib/i18n/dict/accounting";
import { crmQuery, parseCompany, type CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   ADR-067 — THE COMPANY SWITCH.

   Founder: "I can have a switch button between b systems and byte force, and
   the entire boards change accordingly... make sure that this is there, and
   there is no confusion in it."

   So: it renders in the SHELL, which puts it on every switchable screen with
   no page able to forget it; it names the company you are on IN WORDS beside
   the segments, so the current company never rides on colour alone; and it
   marks the active segment with aria-current on top of that.

   It is NOT the module bar and must never read as a second one. The module bar
   (ADR-060) is full-bleed dark chrome directly under the header and answers
   "which module"; this sits on the light page ground, inside the page's own
   width, carries a text label, and answers "which company". Two strips, two
   questions, and the module bar dropped from four segments to three when the
   two CRMs merged — so the phone got WIDER cells, not a competing switcher.

   The companies come from the SERVER (the layout computed them from the live
   roles) — never derived in the browser. Below two, it renders nothing at all,
   exactly as EntitySwitch has always done: a ByteForce-only teammate and a
   B-Systems-only rep get no switch, because there is nothing to switch to.

   THE HREF CARRIES ONLY THE COMPANY. Every other parameter is dropped on
   purpose: `owner`, `stage` and `sort` are B-Systems-shaped and mean nothing to
   the ByteForce bodies, so carrying them over would leave a board that looks
   filtered but is not — which reads as data loss, not as a nav bug.
   ========================================================================== */

/* The paths that exist for BOTH companies keep the path across a switch; every
   other address (a company-exclusive section, or any deep link with an id in
   it) falls back to that company's Home, because the equivalent screen either
   does not exist or is about a record belonging to the other company. */
const SHARED_PATHS = ["/b-systems", "/b-systems/todo", "/b-systems/leads", "/b-systems/crm"];

export function targetFor(pathname: string, company: CrmCompany): string {
  const path = SHARED_PATHS.includes(pathname) ? pathname : "/b-systems";
  return `${path}${crmQuery(company)}`;
}

export function CompanySwitch({
  companies,
  fallback,
}: {
  /** every company the SERVER says this account holds */
  companies: CrmCompany[];
  /** the company in force when the URL does not say (the server's default) */
  fallback: CrmCompany;
}) {
  const t = tFor(useLocale());
  const pathname = usePathname();
  const params = useSearchParams();
  if (companies.length < 2) return null;
  const current = parseCompany(params.get("company")) ?? fallback;
  const currentLabel = t(acctCompanies[current]!);
  return (
    <div className="company-switch">
      {/* the label STATES the company; the segments only offer the move */}
      <p className="company-switch-label">
        {t(shell.companyLabel)}
        <span aria-hidden> · </span>
        <span className="company-switch-current">{currentLabel}</span>
      </p>
      <div className="switcher" role="group" aria-label={t(shell.switchCompany)}>
        {companies.map((company) => (
          <Link
            key={company}
            href={targetFor(pathname, company)}
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
