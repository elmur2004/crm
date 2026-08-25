import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { pnl, trend } from "@/lib/accounting/engine";
import {
  ACCT_EXPENSE_TYPE_LABELS,
  ACCT_INCOME_TYPE_LABELS,
  type AcctExpenseType,
  type AcctIncomeType,
} from "@/lib/accounting/constants";
import { acctView } from "@/lib/accounting/params";
import { monthLabel } from "@/lib/accounting/format";
import { AcctHead } from "@/components/accounting/AcctHead";

/* ADR-052 — the monthly income statement + 6-month trend. Pass-through media
   budgets and loans are excluded by construction (they never enter income or
   expenses — only the fee does). */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctReportPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);
  const p = pnl(books, view.month);
  const points = trend(books, view.month);
  const max = Math.max(1, ...points.map((x) => Math.max(x.income, x.expenses)));
  const incomeLabel = (x: string) =>
    x in ACCT_INCOME_TYPE_LABELS ? t(ACCT_INCOME_TYPE_LABELS[x as AcctIncomeType]) : x;
  const expenseLabel = (x: string) =>
    x in ACCT_EXPENSE_TYPE_LABELS ? t(ACCT_EXPENSE_TYPE_LABELS[x as AcctExpenseType]) : x;

  const typeCard = (
    heading: string,
    entries: Array<[string, number]>,
    emptyText: string,
    total: number,
    totalLabel: string,
    negative: boolean,
  ) => (
    <section className="card card-pad">
      <p className={`u-eyebrow mb-3 ${negative ? "text-brand-danger" : "text-brand-success"}`}>{heading}</p>
      {entries.length === 0 ? (
        <p className="u-muted">{emptyText}</p>
      ) : (
        entries
          .sort((a, b) => b[1] - a[1])
          .map(([type, value]) => (
            <div key={type} className="flex items-baseline justify-between py-1.5 border-b border-brand-hairline">
              <span className="u-muted">{negative ? expenseLabel(type) : incomeLabel(type)}</span>
              <span className="font-medium">
                {negative ? "−" : ""}
                {formatEGP(value)}
              </span>
            </div>
          ))
      )}
      <div className="flex items-baseline justify-between pt-3 font-semibold">
        <span>{totalLabel}</span>
        <span className={negative ? "text-brand-danger" : "text-brand-success"}>{formatEGP(total)}</span>
      </div>
    </section>
  );

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.pnlEyebrow}
        title={acct.pnlTitle}
        sub={acct.pnlSub}
      />

      <div className="grid gap-5 md:grid-cols-2">
        {typeCard(
          t(acct.income),
          Object.entries(p.incomeByType),
          t(acct.noIncomeCollected),
          p.totalIncome,
          t(acct.totalIncome),
          false,
        )}
        {typeCard(
          t(acct.expensesWord),
          Object.entries(p.expenseByType),
          t(acct.noExpensesMonth),
          p.totalExpenses,
          t(acct.totalExpenses),
          true,
        )}
      </div>

      <section className="card card-pad flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="u-eyebrow">
            {t(acct.netProfitLoss)} · {monthLabel(view.month, locale)}
          </p>
          <p className={`u-h1 ${p.net >= 0 ? "" : "text-brand-danger"}`}>{formatEGP(p.net)}</p>
        </div>
        <div className="text-end">
          <p className="u-eyebrow">{t(acct.netMargin)}</p>
          <p className="u-h1">{p.marginPct.toFixed(1)}%</p>
        </div>
      </section>

      <section className="card card-pad">
        <p className="u-eyebrow mb-3">{t(acct.sixMonthTrend)}</p>
        <div className="space-y-2">
          {points.map((x) => (
            <div key={x.month} className="chart-row text-sm">
              <span className="w-28 shrink-0 text-brand-muted">{monthLabel(x.month, locale)}</span>
              <div className="flex-1 space-y-1">
                <div className="meter" style={{ height: 8 }}>
                  <div className="meter-fill bg-brand-success" style={{ width: `${(x.income / max) * 100}%` }} />
                </div>
                <div className="meter" style={{ height: 8 }}>
                  <div className="meter-fill bg-brand-danger" style={{ width: `${(x.expenses / max) * 100}%` }} />
                </div>
              </div>
              <span className={`w-28 text-end font-medium ${x.net >= 0 ? "text-brand-success" : "text-brand-danger"}`}>
                {x.net >= 0 ? "+" : "−"}
                {formatEGP(Math.abs(x.net))}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 u-muted">
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-success" /> {t(acct.income)}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-brand-danger" /> {t(acct.expensesWord)}
          </span>
        </div>
      </section>
    </div>
  );
}
