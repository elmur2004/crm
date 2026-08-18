import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { formatEGP } from "@/lib/money";
import { loadBooks } from "@/lib/accounting/books";
import { dashboard } from "@/lib/accounting/engine";
import { cairoMonth } from "@/lib/accounting/now";
import { acctView } from "@/lib/accounting/params";
import { monthLabel } from "@/lib/accounting/format";
import { AcctHead, AcctTile } from "@/components/accounting/AcctHead";

/* ADR-052 — the accounting dashboard: the SPA's overview screen. Every figure
   is for the selected month; treasury / loan / client balances are cumulative. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  await requireBsAdminPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams);
  const books = await loadBooks(view.company);
  const d = dashboard(books, view.month, cairoMonth());
  const pct = d.target && d.target.goal > 0 ? Math.min(100, (d.target.collected / d.target.goal) * 100) : 0;

  return (
    <div className="space-y-5">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.dashEyebrow}
        title={acct.tabDashboard}
        sub={acct.dashSub}
      />

      <section className="card card-pad">
        <p className="u-eyebrow">{t(acct.treasuryBalance)}</p>
        <p className="u-h1">{formatEGP(d.treasuryNow)}</p>
        <p className="u-muted mt-2">
          {t(acct.cashCarried)} · {t(acct.monthNetProfit)}{" "}
          <strong className={d.monthNet >= 0 ? "text-brand-success" : "text-brand-danger"}>
            {formatEGP(d.monthNet)}
          </strong>
        </p>
      </section>

      <div className="tile-grid">
        <AcctTile label={t(acct.incomeCollected)} value={formatEGP(d.incomeCollected)} tone="success" />
        <AcctTile
          label={t(acct.expensesPaid)}
          value={formatEGP(d.expensesPaid)}
          sub={t(acct.approvedThisMonth)}
          tone="danger"
        />
        <AcctTile label={t(acct.toBePaid)} value={formatEGP(d.onHold)} sub={t(acct.awaitingApproval)} />
        <AcctTile
          label={t(acct.monthNetProfit)}
          value={formatEGP(d.monthNet)}
          tone={d.monthNet >= 0 ? "success" : "danger"}
        />
      </div>
      <div className="tile-grid">
        <AcctTile label={t(acct.accountsReceivable)} value={formatEGP(d.accountsReceivable)} sub={t(acct.uncollectedAllMonths)} />
        <AcctTile label={t(acct.accountsPayable)} value={formatEGP(d.accountsPayable)} sub={t(acct.onHoldAllMonths)} />
        <AcctTile
          label={t(acct.committedSalary)}
          value={formatEGP(d.committedSalary)}
          sub={`${d.activeStaff} ${t(acct.activeStaff)}`}
        />
        <AcctTile label={t(acct.clientsOweYou)} value={formatEGP(d.clientsOwe)} />
      </div>
      <div className="tile-grid">
        <AcctTile label={t(acct.weOweLoans)} value={formatEGP(d.loansOwe)} tone={d.loansOwe > 0 ? "danger" : undefined} />
        <AcctTile label={t(acct.owedToUsLoans)} value={formatEGP(d.loansOwed)} />
      </div>

      {d.target ? (
        <section className="card card-pad">
          <div className="flex items-baseline justify-between gap-3 flex-wrap mb-2">
            <span className="u-eyebrow">
              {t(acct.target)} · {monthLabel(view.month, locale)}
            </span>
            <span className="u-muted">
              {formatEGP(d.target.collected)} / {formatEGP(d.target.goal)}
            </span>
          </div>
          <div className="meter">
            <div
              className={`meter-fill ${d.target.collected >= d.target.goal ? "bg-brand-success" : "bg-brand-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
