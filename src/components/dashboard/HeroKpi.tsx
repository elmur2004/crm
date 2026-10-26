import { formatEGP } from "@/lib/money";
import { formatCairoMonthShort } from "@/lib/datetime";
import { monthPeriod } from "@/lib/dashboard/periods";
import { dash as m, vsLabels, wonTitles } from "@/lib/i18n/dict/dashboard";
import type { DashboardData } from "@/lib/services/dashboard";
import { KpiCard } from "./KpiCard";
import { Sparkline } from "./Sparkline";
import type { DashCtx } from "./ctx";

/* K1 — the featured card: Won in the period, BOOKED value (dashboard spec W1,
   §2.4). "Booked" is on the card because it is not cash: the cash is
   Accounting's, behind its own per-admin flag (ADR-066), and is not linked to
   any lead — so a CRM tile called "Revenue" would be one of three different
   numbers depending on who wrote the query.

   Ground: Systems Indigo (--color-chrome — the header's own anchor, in both
   themes; D3). The sparkline is Process Lavender on it. Pink stays the Won
   cue elsewhere and never becomes a surface.

   Not a link (one way to each page): Won Leads and Clients are in the CRM
   menus; the period's wins themselves are listed, as records, under Recent
   wins. */

export function HeroKpi({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const { t, f } = ctx;
  const won = data.kpis.won;
  const key = data.period.key;
  const trendList = data.period.trendMonths
    .map((month, i) => `${formatCairoMonthShort(monthPeriod(month).start, ctx.locale)} ${formatEGP(won.spark[i] ?? 0)}`)
    .join(", ");
  return (
    <KpiCard
      ctx={ctx}
      hero
      metric="won_period"
      dataValue={won.value}
      extraData={{ "data-count": won.count }}
      label={t(wonTitles[key])}
      eyebrow={ctx.curDatesShort}
      value={won.value}
      format="egp"
      delta={won.delta}
      prevText={formatEGP(won.prevValue)}
      vsText={t(vsLabels[key])}
      sub={
        <>
          <span>{f(m.dealsWon, { n: won.count })}</span>
          <span className="db-kpi-note">{t(m.bookedNotCash)}</span>
          <span className="sr-only">{f(m.wonTrend, { list: trendList })}</span>
        </>
      }
      visual={<Sparkline values={won.spark} className="db-spark--hero" />}
    />
  );
}
