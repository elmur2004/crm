import Link from "next/link";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { departments } from "@/lib/accounting/engine";
import { cairoMonth } from "@/lib/accounting/now";
import { ACCT_DEPT_LABELS, ACCT_DEPTS, mediaHidden, type AcctDept } from "@/lib/accounting/constants";
import { acctQuery, acctView } from "@/lib/accounting/params";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { monthLabel } from "@/lib/accounting/format";
import { AcctHead } from "@/components/accounting/AcctHead";

/* ADR-052 — department profitability: tagged income vs tagged cost (derived
   payroll included), untagged spend as shared overhead. Month / all-time. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctDepartmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string; scope?: string }>;
}) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const params = await searchParams;
  const view = acctView(params, moduleCompaniesFor(user.roles));
  const scope = params.scope === "all" ? "all" : "month";
  const books = await loadBooks(view.company);
  const deptIds = ACCT_DEPTS.filter((d) => d !== "media_fee" || !mediaHidden(view.company));
  const rep = departments(books, view.month, scope, cairoMonth(), deptIds);
  const deptLabel = (d: string) =>
    d in ACCT_DEPT_LABELS ? t(ACCT_DEPT_LABELS[d as AcctDept]) : d;

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.deptsEyebrow}
        title={acct.deptsTitle}
        sub={acct.deptsSub}
      />
      <div className="page-actions">
        <div className="switcher" role="group" aria-label={t(acct.scope)}>
          <Link
            className="switcher-seg"
            aria-current={scope === "month" ? "true" : undefined}
            href={`/accounting/departments${acctQuery(view)}`}
          >
            {monthLabel(view.month, locale)}
          </Link>
          <Link
            className="switcher-seg"
            aria-current={scope === "all" ? "true" : undefined}
            href={`/accounting/departments${acctQuery(view)}&scope=all`}
          >
            {t(acct.allTime)}
          </Link>
        </div>
      </div>

      <section className="card card--flush0">
        {rep.rows.length === 0 ? (
          <p className="empty m-4">{t(acct.noDeptActivity)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.department)}</th>
                  <th>{t(acct.income)}</th>
                  <th>{t(acct.directCost)}</th>
                  <th>{t(acct.profit)}</th>
                  <th>{t(acct.margin)}</th>
                </tr>
              </thead>
              <tbody>
                {rep.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="td-title">{deptLabel(r.id)}</td>
                    <td className="text-brand-success">{formatEGP(r.income)}</td>
                    <td className={r.cost ? "text-brand-danger" : ""}>{r.cost ? formatEGP(r.cost) : "—"}</td>
                    <td className={`td-title ${r.profit >= 0 ? "" : "text-brand-danger"}`}>{formatEGP(r.profit)}</td>
                    <td>{r.income > 0 ? `${r.marginPct.toFixed(0)}%` : "—"}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="td-title">{t(acct.directTotal)}</td>
                  <td className="text-brand-success">{formatEGP(rep.totalIncome)}</td>
                  <td className="text-brand-danger">{formatEGP(rep.totalCost)}</td>
                  <td className={rep.directProfit >= 0 ? "" : "text-brand-danger"}>{formatEGP(rep.directProfit)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card card-pad">
        <div className="flex items-baseline justify-between py-1.5 border-b border-brand-hairline">
          <span className="u-muted">{t(acct.directDeptProfit)}</span>
          <span className="font-medium">{formatEGP(rep.directProfit)}</span>
        </div>
        <div className="flex items-baseline justify-between py-1.5 border-b border-brand-hairline">
          <span className="u-muted">{t(acct.sharedOverhead)}</span>
          <span className="font-medium text-brand-danger">−{formatEGP(rep.overhead)}</span>
        </div>
        <div className="flex items-baseline justify-between pt-3">
          <span className="u-h3">{t(acct.netAfterOverhead)}</span>
          <span className={`u-h2 ${rep.netAfterOverhead >= 0 ? "" : "text-brand-danger"}`}>
            {formatEGP(rep.netAfterOverhead)}
          </span>
        </div>
      </section>
    </div>
  );
}
