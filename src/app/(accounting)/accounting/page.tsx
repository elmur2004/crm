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
import { AcctHead, AcctKpi } from "@/components/accounting/AcctHead";

/* ADR-052 / ADR-054 design exception — the accounting dashboard KEEPS THE
   ORIGINAL SPA's design (founder, with screenshot): the gradient hero banner
   for the live treasury balance, then the KPI cards with colored accent edges
   and colored figures. Every figure is for the selected month; treasury /
   loan / client balances are cumulative. The colors are brand tokens, so the
   company switch re-brands the whole screen (directive D). */

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
        eyebrowExtra={monthLabel(view.month, locale)}
        eyebrowAccent
        title={acct.tabDashboard}
        sub={acct.dashSub}
      />

      {/* hero: treasury on the brand gradient (the SPA's corner shapes included) */}
      <section className="acct-hero">
        <svg
          className="acct-hero-shape"
          viewBox="0 0 300 360"
          width="200"
          fill="currentColor"
          aria-hidden
        >
          <rect x="0" y="0" width="42" height="256" />
          <rect x="0" y="214" width="300" height="42" />
          <polygon points="170,256 274,256 170,358" />
        </svg>
        <div className="acct-hero-body">
          <p className="acct-hero-eyebrow">
            {t(acct.treasuryBalance)} · {t(acct.nowWord)}
          </p>
          <p className="acct-hero-value">{formatEGP(d.treasuryNow)}</p>
          <p className="acct-hero-sub">
            {t(acct.cashCarried)} · {t(acct.monthNetProfit)}{" "}
            <b>
              {d.monthNet >= 0 ? "+" : "−"}
              {formatEGP(Math.abs(d.monthNet))}
            </b>
          </p>
        </div>
      </section>

      <div className="acct-kpi-grid">
        <AcctKpi label={t(acct.incomeCollected)} value={formatEGP(d.incomeCollected)} tone="success" accent />
        <AcctKpi
          label={t(acct.expensesPaid)}
          value={formatEGP(d.expensesPaid)}
          sub={t(acct.approvedThisMonth)}
          tone="danger"
          accent
        />
        <AcctKpi
          label={t(acct.toBePaid)}
          value={formatEGP(d.onHold)}
          sub={t(acct.awaitingApproval)}
          tone="warning"
          accent
        />
        <AcctKpi
          label={t(acct.monthNetProfit)}
          value={formatEGP(d.monthNet)}
          tone={d.monthNet >= 0 ? "net" : "danger"}
          accent
        />
      </div>
      <div className="acct-kpi-grid">
        <AcctKpi
          label={t(acct.accountsReceivable)}
          value={formatEGP(d.accountsReceivable)}
          sub={t(acct.uncollectedAllMonths)}
          tone="warning"
          accent
        />
        <AcctKpi
          label={t(acct.accountsPayable)}
          value={formatEGP(d.accountsPayable)}
          sub={t(acct.onHoldAllMonths)}
          tone={d.accountsPayable > 0 ? "danger" : "muted"}
          accent
        />
        <AcctKpi
          label={t(acct.committedSalary)}
          value={formatEGP(d.committedSalary)}
          sub={`${d.activeStaff} ${t(acct.activeStaff)}`}
          tone="warning"
        />
        <AcctKpi
          label={t(acct.clientsOweYou)}
          value={formatEGP(d.clientsOwe)}
          tone={d.clientsOwe > 0 ? "warning" : "muted"}
        />
      </div>
      <div className="acct-kpi-grid">
        <AcctKpi
          label={t(acct.weOweLoans)}
          value={formatEGP(d.loansOwe)}
          tone={d.loansOwe > 0 ? "danger" : "muted"}
        />
        <AcctKpi
          label={t(acct.owedToUsLoans)}
          value={formatEGP(d.loansOwed)}
          tone={d.loansOwed > 0 ? "success" : "muted"}
        />
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
            {/* the SPA: gradient fill while under goal, success once reached */}
            <div
              className={`meter-fill ${d.target.collected >= d.target.goal ? "bg-brand-success" : "bg-brand-hero"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
