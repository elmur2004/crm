import { requireAccountingPage } from "@/lib/auth/page-guards";
import { getLocale } from "@/lib/i18n/server";
import { tFor } from "@/lib/i18n/core";
import { acct } from "@/lib/i18n/dict/accounting";
import { loadBooks } from "@/lib/accounting/books";
import { dashboard } from "@/lib/accounting/engine";
import { cairoMonth } from "@/lib/accounting/now";
import { acctView } from "@/lib/accounting/params";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { monthLabel } from "@/lib/accounting/format";
import { AcctHead, AcctKpi } from "@/components/accounting/AcctHead";
import { ModSwap } from "@/components/accounting/module-ui";
import { LiveNumber } from "@/components/dashboard/LiveNumber";

/* ADR-052 / ADR-054 design exception — the accounting dashboard KEEPS THE
   ORIGINAL SPA's design (founder, with screenshot): the gradient hero banner
   for the live treasury balance, then the KPI cards with colored accent edges
   and colored figures. Every figure is for the selected month; treasury /
   loan / client balances are cumulative. The colors are brand tokens, so the
   company switch re-brands the whole screen (directive D).

   Motion (the glass pass — src/themes/modules.css): the sections arrive in
   turn and the KPI cards are dealt; the figures are the server's from the
   first frame and COUNT only when they change under the same card — a month
   flicked keeps every card and counts each figure to the new month's; a
   company switch is other books entirely, so the data cross-fades in anew
   (ModSwap keyed by company). */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(acct.metaTitle) };
}

export default async function AcctDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string; month?: string }>;
}) {
  const user = await requireAccountingPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const view = acctView(await searchParams, moduleCompaniesFor(user.roles));
  const books = await loadBooks(view.company);
  const d = dashboard(books, view.month, cairoMonth());
  const pct = d.target && d.target.goal > 0 ? Math.min(100, (d.target.collected / d.target.goal) * 100) : 0;

  return (
    <div className="space-y-5 mod-page">
      <AcctHead
        view={view}
        locale={locale}
        eyebrow={acct.dashEyebrow}
        eyebrowExtra={monthLabel(view.month, locale)}
        eyebrowAccent
        title={acct.tabDashboard}
        sub={acct.dashSub}
        /* no extra "Import" door here (one way to each page): Import is in the
           module's menu, and the menu's slider shows its chevrons whenever the
           strip clips (ShellNav) — the reason this button once existed */
      />

      <ModSwap swapKey={view.company} className="space-y-5">
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
            <p className="acct-hero-value">
              <LiveNumber value={d.treasuryNow} format="egp" />
            </p>
            <p className="acct-hero-sub">
              {t(acct.cashCarried)} · {t(acct.monthNetProfit)}{" "}
              <b>
                {d.monthNet >= 0 ? "+" : "−"}
                <LiveNumber value={Math.abs(d.monthNet)} format="egp" />
              </b>
            </p>
          </div>
        </section>

        <div className="acct-kpi-grid">
          <AcctKpi label={t(acct.incomeCollected)} amount={d.incomeCollected} tone="success" accent />
          <AcctKpi
            label={t(acct.expensesPaid)}
            amount={d.expensesPaid}
            sub={t(acct.approvedThisMonth)}
            tone="danger"
            accent
          />
          <AcctKpi
            label={t(acct.toBePaid)}
            amount={d.onHold}
            sub={t(acct.awaitingApproval)}
            tone="warning"
            accent
          />
          <AcctKpi
            label={t(acct.monthNetProfit)}
            amount={d.monthNet}
            tone={d.monthNet >= 0 ? "net" : "danger"}
            accent
          />
        </div>
        <div className="acct-kpi-grid">
          <AcctKpi
            label={t(acct.accountsReceivable)}
            amount={d.accountsReceivable}
            sub={t(acct.uncollectedAllMonths)}
            tone="warning"
            accent
          />
          <AcctKpi
            label={t(acct.accountsPayable)}
            amount={d.accountsPayable}
            sub={t(acct.onHoldAllMonths)}
            tone={d.accountsPayable > 0 ? "danger" : "muted"}
            accent
          />
          <AcctKpi
            label={t(acct.committedSalary)}
            amount={d.committedSalary}
            sub={`${d.activeStaff} ${t(acct.activeStaff)}`}
            tone="warning"
          />
          <AcctKpi
            label={t(acct.clientsOweYou)}
            amount={d.clientsOwe}
            tone={d.clientsOwe > 0 ? "warning" : "muted"}
          />
        </div>
        <div className="acct-kpi-grid">
          <AcctKpi
            label={t(acct.weOweLoans)}
            amount={d.loansOwe}
            tone={d.loansOwe > 0 ? "danger" : "muted"}
          />
          <AcctKpi
            label={t(acct.owedToUsLoans)}
            amount={d.loansOwed}
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
                <LiveNumber value={d.target.collected} format="egp" /> /{" "}
                <LiveNumber value={d.target.goal} format="egp" />
              </span>
            </div>
            <div className="meter">
              {/* the SPA: gradient fill while under goal, success once reached.
                  Keyed by the month: a new month's progress draws again from
                  its baseline (modules.css) instead of jumping */}
              <div
                key={view.month}
                className={`meter-fill ${d.target.collected >= d.target.goal ? "bg-brand-success" : "bg-brand-hero"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </section>
        ) : null}
      </ModSwap>
    </div>
  );
}
