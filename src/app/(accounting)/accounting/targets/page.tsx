import { redirect } from "next/navigation";
import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { db } from "@/lib/db";
import { loadBooks } from "@/lib/accounting/books";
import { incomeIn } from "@/lib/accounting/engine";
import { acctQuery, acctView } from "@/lib/accounting/params";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { hasAcctSection } from "@/lib/module-sections";
import { monthLabel } from "@/lib/accounting/format";
import { AcctHead } from "@/components/accounting/AcctHead";
import { AddTargetButton, TargetActions } from "@/components/accounting/forms";

/* ADR-052 — monthly collected-income targets; the dashboard shows the
   selected month's progress bar. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctTargetsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams, moduleCompaniesFor(user.roles));
  /* ADR-076 — a section this company does not have is REFUSED, not merely
     hidden from the nav. The founder named Mindoo's sections; leaving the page
     reachable by typing its address would make that a tidier menu rather than a
     decision about what the company has. Redirect to the module root, which
     every company keeps — never a 404, because the section exists, it is simply
     not this company's. */
  if (!hasAcctSection(view.company, "/accounting/targets")) redirect(`/accounting${acctQuery(view)}`);
  const [books, targets] = await Promise.all([
    loadBooks(view.company),
    db.acctTarget.findMany({ where: { company: view.company }, orderBy: { period: "desc" } }),
  ]);

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.targetsEyebrow}
        title={acct.targetsTitle}
        sub={acct.targetsSub}
        showMonth={false}
      />
      <div className="page-actions">
        <AddTargetButton company={view.company} month={view.month} />
      </div>
      <section className="card card--flush0">
        {targets.length === 0 ? (
          <p className="empty m-4">{t(acct.noTargets)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.monthCol)}</th>
                  <th>{t(acct.goal)}</th>
                  <th>{t(acct.collected)}</th>
                  <th>{t(acct.progress)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {targets.map((target) => {
                  const got = incomeIn(books, target.period);
                  const pct = target.goal > 0 ? (got / target.goal) * 100 : 0;
                  return (
                    <tr key={target.id}>
                      <td className="td-title">{monthLabel(target.period, locale)}</td>
                      <td>{formatEGP(target.goal)}</td>
                      <td className="text-brand-success">{formatEGP(got)}</td>
                      <td>
                        <span className="flex items-center gap-2 min-w-40">
                          <span className="meter" style={{ height: 8 }}>
                            <span
                              className={`meter-fill block ${pct >= 100 ? "bg-brand-success" : "bg-brand-primary"}`}
                              style={{ width: `${Math.min(100, pct)}%` }}
                            />
                          </span>
                          <span className="font-medium">{pct.toFixed(0)}%</span>
                        </span>
                      </td>
                      <td>
                        <TargetActions id={target.id} company={view.company} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
