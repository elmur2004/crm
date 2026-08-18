import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { incomeMonth } from "@/lib/accounting/engine";
import { ACCT_DEPT_LABELS, ACCT_INCOME_TYPE_LABELS, type AcctDept, type AcctIncomeType } from "@/lib/accounting/constants";
import { acctView } from "@/lib/accounting/params";
import { AcctChip, AcctHead, AcctTile } from "@/components/accounting/AcctHead";
import { AddIncomeButton, IncomeActions } from "@/components/accounting/forms";

/* ADR-052 — income (cash basis): a row shows under its issue month, and — once
   collected — under the month the cash landed (exactly the SPA's filter). */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctIncomePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);

  const rows = books.income.filter(
    (i) => i.month === view.month || (i.collected && incomeMonth(i) === view.month),
  );
  const collected = rows
    .filter((i) => i.collected && incomeMonth(i) === view.month)
    .reduce((s, i) => s + i.amount, 0);
  const pending = rows.filter((i) => !i.collected).reduce((s, i) => s + i.amount, 0);
  const deptLabel = (d: string) =>
    d in ACCT_DEPT_LABELS ? t(ACCT_DEPT_LABELS[d as AcctDept]) : d || "—";
  const typeLabel = (x: string) =>
    x in ACCT_INCOME_TYPE_LABELS ? t(ACCT_INCOME_TYPE_LABELS[x as AcctIncomeType]) : x;

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.incomeEyebrow}
        title={acct.incomeTitle}
        sub={acct.incomeSub}
      />
      <div className="page-actions">
        <AddIncomeButton company={view.company} month={view.month} />
      </div>
      <div className="tile-grid">
        <AcctTile label={t(acct.collectedThisMonth)} value={formatEGP(collected)} tone="success" />
        <AcctTile label={t(acct.pendingReceivable)} value={formatEGP(pending)} />
      </div>
      <section className="card card--flush0">
        {rows.length === 0 ? (
          <p className="empty m-4">{t(acct.noIncome)}</p>
        ) : (
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(acct.type)}</th>
                  <th>{t(acct.client)}</th>
                  <th>{t(acct.department)}</th>
                  <th>{t(acct.note)}</th>
                  <th>{t(acct.amount)}</th>
                  <th>{t(acct.collectedOn)}</th>
                  <th>{t(acct.status)}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id}>
                    <td>{typeLabel(i.type)}</td>
                    <td className="td-title">{i.client || "—"}</td>
                    <td>
                      <span className="chip-outline">{deptLabel(i.serviceLine)}</span>
                    </td>
                    <td className="td-mono">{i.note || "—"}</td>
                    <td className="td-title">{formatEGP(i.amount)}</td>
                    <td className="td-mono u-ltr">{i.collectedDate ?? "—"}</td>
                    <td>
                      {i.collected ? (
                        <AcctChip kind="good">{t(acct.collected)}</AcctChip>
                      ) : (
                        <AcctChip kind="wait">{t(acct.pendingStatus)}</AcctChip>
                      )}
                    </td>
                    <td>
                      <IncomeActions
                        row={{
                          id: i.id,
                          month: i.month,
                          type: i.type,
                          client: i.client,
                          serviceLine: i.serviceLine,
                          amount: i.amount,
                          note: i.note,
                          collected: i.collected,
                          collectedDate: i.collectedDate,
                        }}
                        company={view.company}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
