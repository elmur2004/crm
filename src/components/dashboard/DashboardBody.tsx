import Link from "next/link";
import "@/themes/dashboard.css";
import { formatEGP } from "@/lib/money";
import { formatCairoLongDate, formatCairoMonthShort } from "@/lib/datetime";
import { monthPeriod, type RangeKey } from "@/lib/dashboard/periods";
import { rateOf, ratePct } from "@/lib/dashboard/delta";
import { crmQuery, type CrmCompany } from "@/lib/crm/company";
import type { Locale } from "@/lib/i18n/core";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { dash as m, vsLabels } from "@/lib/i18n/dict/dashboard";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { dashboardFor, type DashboardData } from "@/lib/services/dashboard";
import type { TodoScope } from "@/lib/services/todo";
import { stageKey } from "@/components/bsystems/stageColors";
import { BackupControls } from "@/components/bsystems/backup";
import { ActivityFeed } from "./ActivityFeed";
import { ChartTable } from "./ChartTable";
import { DashboardRefresh } from "./DashboardRefresh";
import { Funnel } from "./Funnel";
import { HeroKpi } from "./HeroKpi";
import { KpiCard } from "./KpiCard";
import { LiveNumber } from "./LiveNumber";
import { NeedsYou } from "./NeedsYou";
import { Panel } from "./Panel";
import { RangePicker } from "./RangePicker";
import { RankedBars } from "./RankedBars";
import { RecentWins } from "./RecentWins";
import { SemiMeter } from "./SemiMeter";
import { Sparkline } from "./Sparkline";
import { StageBars, stageTableRows } from "./StageBars";
import { TasksCard } from "./TasksCard";
import { TeamCard } from "./TeamCard";
import { TrendLine } from "./TrendLine";
import { cssVars, makeCtx, type DashCtx } from "./ctx";

/* ============================================================================
   THE HOME — one server body for both companies (dashboard spec §4, §7).

   ADR-067: the merged CRM shell wears the B-Systems skin for both companies;
   only the DATA follows the company. Every figure comes from one call,
   `dashboardFor`, whose every lead predicate is the To-Do's own wall.

   Layout (dashboard.css): a 12-column grid that is its own container, so the
   breakpoints follow the space the page actually has — desktop (KPIs 3/3/3/3,
   then 7/5, 4/3/5, 5/7, 7/5), tablet (2×2 KPIs, then pairs), phone (one column,
   tasks right after the KPIs — they are what he acts on).
   ========================================================================== */

const BRAND_EYEBROW: Record<CrmCompany, string> = {
  bsystems: "B-SYSTEMS",
  byteforce: "BYTEFORCE",
};

export async function DashboardBody({
  company,
  scope,
  range,
  locale,
  viewerName,
  showBackup = false,
}: {
  company: CrmCompany;
  scope: TodoScope;
  range: RangeKey;
  locale: Locale;
  viewerName: string;
  showBackup?: boolean;
}) {
  const data = await dashboardFor({ brand: company, scope, range });
  const ctx = makeCtx({
    locale,
    brand: company,
    query: crmQuery(company),
    apiBase: company === "bsystems" ? "/api/b-systems" : "/api/byteforce",
    period: data.period,
  });
  const { t, f } = ctx;
  const firstName = viewerName.trim().split(/\s+/)[0] ?? viewerName;
  const hasNeeds = data.needsYou !== null;

  return (
    <div className="db" data-range={range} data-company={company}>
      <DashboardRefresh />
      <header className="db-head">
        <div className="db-head-text">
          <p className="u-eyebrow">
            {BRAND_EYEBROW[company]} · {t(m.eyebrowHome)}
          </p>
          <h1 className="db-title">{f(m.welcome, { name: firstName })}</h1>
          <p className="db-date">{formatCairoLongDate(data.now, locale)}</p>
        </div>
        <div className="db-head-actions">
          <RangePicker range={range} ctx={ctx} />
          {showBackup ? <BackupControls /> : null}
        </div>
      </header>

      <div className={`db-grid${hasNeeds ? "" : " db-grid--no-needs"}`}>
        {/* ---- the four KPIs (§3.1) */}
        <section className="db-kpis" aria-label={t(m.keyFigures)}>
          <HeroKpi data={data} ctx={ctx} />
          <NewLeadsCard data={data} ctx={ctx} />
          <WinRateCard data={data} ctx={ctx} />
          <PipelineCard data={data} ctx={ctx} />
        </section>

        <LeadsPerStageCard data={data} ctx={ctx} />
        <Funnel steps={data.funnel} ctx={ctx} />
        <TasksCard data={data} ctx={ctx} />
        {data.needsYou ? <NeedsYou data={data.needsYou} ctx={ctx} /> : null}
        <RecentWins wins={data.recentWins} ctx={ctx} />
        <RankedBars rows={data.sources} partnerReferred={data.partnerReferred} ctx={ctx} />
        <TrendLine points={data.trend} ctx={ctx} />
        {data.team ? <TeamCard rows={data.team} ctx={ctx} /> : null}
        <ActivityFeed rows={data.activity} now={data.now} ctx={ctx} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- K2 */

function NewLeadsCard({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const k = data.kpis.newLeads;
  const list = data.period.trendMonths
    .map((month, i) => `${formatCairoMonthShort(monthPeriod(month).start, ctx.locale)} ${k.spark[i] ?? 0}`)
    .join(", ");
  return (
    <KpiCard
      ctx={ctx}
      href={`/b-systems/leads${ctx.query}`}
      metric="new_leads"
      dataValue={k.value}
      label={ctx.t(m.newLeads)}
      eyebrow={ctx.curDatesShort}
      value={k.value}
      format="int"
      delta={k.delta}
      prevText={String(k.prev)}
      vsText={ctx.t(vsLabels[data.period.key])}
      sub={<span className="sr-only">{ctx.f(m.newLeadsTrend, { list })}</span>}
      visual={<Sparkline values={k.spark} />}
    />
  );
}

/* ---------------------------------------------------------------- K3 */

function WinRateCard({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const k = data.kpis.winRate;
  const pct = ratePct(k.cur);
  const prevPct = ratePct(k.prev);
  return (
    <KpiCard
      ctx={ctx}
      metric="win_rate"
      dataValue={pct}
      extraData={{ "data-won": k.cur.won, "data-lost": k.cur.lost }}
      label={ctx.t(m.winRate)}
      eyebrow={ctx.curDatesShort}
      value={pct}
      format="pct"
      emptyText="—"
      delta={k.delta}
      prevText={prevPct === null ? "—" : `${prevPct}%`}
      vsText={ctx.t(vsLabels[data.period.key])}
      sub={
        pct === null ? (
          <span>{ctx.f(m.noClosedDeals, { dates: ctx.curDates })}</span>
        ) : (
          <span>{ctx.f(m.wonLost, { won: k.cur.won, lost: k.cur.lost })}</span>
        )
      }
      visual={<SemiMeter fraction={rateOf(k.cur)} dir={ctx.dir} />}
    />
  );
}

/* ---------------------------------------------------------------- K4 */

function PipelineCard({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const k = data.kpis.pipeline;
  const segments = k.byStage.filter((s) => s.value > 0);
  return (
    <KpiCard
      ctx={ctx}
      href={`/b-systems/crm${ctx.query}`}
      metric="pipeline_value"
      dataValue={k.value}
      extraData={{ "data-open": k.openCount, "data-parked": k.parkedValue }}
      label={ctx.t(m.pipelineValue)}
      eyebrow={ctx.t(m.eyebrowNow)}
      value={k.value}
      format="egp"
      sub={
        <>
          <span>{ctx.f(m.openLeads, { n: k.openCount })}</span>
          {k.parkedValue > 0 ? (
            <span>
              {ctx.f(m.ofWhichParked, { value: formatEGP(k.parkedValue) })}
            </span>
          ) : null}
          <span className="sr-only">
            {ctx.t(m.pipelineByStage)}:{" "}
            {k.byStage.map((s) => `${stageLabel(ctx.locale, s.stage)} ${formatEGP(s.value)}`).join(", ")}
          </span>
        </>
      }
      visual={
        <span className="db-stack" aria-hidden>
          {segments.map((s) => (
            <span
              key={s.stage}
              className="db-stack-seg"
              data-stage-key={stageKey(s.stage)}
              style={cssVars({ "--share": k.value > 0 ? s.value / k.value : 0 })}
            />
          ))}
        </span>
      }
    />
  );
}

/* ---------------------------------------------------------------- W5 */

function LeadsPerStageCard({ data, ctx }: { data: DashboardData; ctx: DashCtx }) {
  const { t, f } = ctx;
  const s = data.snapshot;
  const items = Object.entries(s.leadsPerStage).map(([stage, count]) => ({ stage, count }));
  const top = [...items].sort((a, b) => b.count - a.count)[0];
  const isBs = data.brand === "bsystems";
  const config = configForBrand(data.brand);
  const label = (stage: string) =>
    stage === config.intakeStage ? t(m.newNotActioned) : stageLabel(ctx.locale, stage);
  const external = data.external;
  const extItems = external
    ? Object.entries(external.externalPipeline).map(([stage, count]) => ({ stage, count }))
    : [];
  const extTotal = extItems.reduce((a, i) => a + i.count, 0);

  const stats: Array<{ metric: string; label: string; value: number; format: "int" | "egp" }> = [
    { metric: "total_leads", label: t(m.totalLeads), value: s.totalLeads, format: "int" },
    { metric: "won_value", label: t(m.wonValue), value: s.wonValue, format: "egp" },
    { metric: "won_count", label: stageLabel(ctx.locale, config.wonStage), value: s.wonCount, format: "int" },
    { metric: "lost_count", label: stageLabel(ctx.locale, config.lostStage), value: s.lostCount, format: "int" },
    isBs
      ? { metric: "milestones_outstanding", label: t(m.milestonesOutstanding), value: s.toBeCollected, format: "egp" }
      : { metric: "to_be_collected", label: t(m.toBeCollected), value: s.toBeCollected, format: "egp" },
  ];

  return (
    <Panel
      id="db-stages"
      className="db-w-stages"
      title={t(m.leadsPerStage)}
      eyebrow={t(m.eyebrowNow)}
      action={
        <Link href={`/b-systems/crm${ctx.query}`} prefetch={false} className="db-link">
          {t(m.openBoard)}
        </Link>
      }
      summary={
        s.totalLeads === 0 || !top ? (
          <>
            {t(m.noLeadsYet)}{" "}
            <Link href={`/b-systems/leads${ctx.query}`} prefetch={false} className="db-link">
              {t(m.addLead)}
            </Link>
          </>
        ) : (
          f(m.stageSummary, { stage: label(top.stage), n: top.count })
        )
      }
    >
      <StageBars items={items} ctx={ctx} idPrefix="db-stages" metricPrefix="stage" />
      <ChartTable
        label={t(m.viewAsTable)}
        head={[t(m.thStage), t(m.thLeads), t(m.thShare)]}
        rows={stageTableRows(items, ctx)}
      />

      <dl className="db-stats">
        {stats.map((st) => (
          <div key={st.metric} className="db-stat" data-metric={st.metric} data-value={st.value}>
            <dt>{st.label}</dt>
            <dd>
              <bdi>
                <LiveNumber value={st.value} format={st.format} />
              </bdi>
            </dd>
          </div>
        ))}
      </dl>
      <p className="db-caption">{t(m.allTimeFootnote)}</p>

      {external ? (
        <section className="db-external" aria-labelledby="db-external-title">
          <h3 className="db-external-title" id="db-external-title">
            {t(m.externalPipeline)}
          </h3>
          <div className="db-external-roster">
            <Link href="/b-systems/agents" prefetch={false} className="db-roster" data-metric="agents" data-value={external.agentCount}>
              <span className="db-roster-label">{t(m.agents)}</span>
              <span className="db-roster-value">
                <bdi>
                  <LiveNumber value={external.agentCount} />
                </bdi>
              </span>
              {external.pendingAgentCount > 0 ? (
                <span className="db-roster-sub">{f(m.pendingAgents, { n: external.pendingAgentCount })}</span>
              ) : null}
            </Link>
            <Link href="/b-systems/partners" prefetch={false} className="db-roster" data-metric="partners" data-value={external.partnerCount}>
              <span className="db-roster-label">{t(m.partners)}</span>
              <span className="db-roster-value">
                <bdi>
                  <LiveNumber value={external.partnerCount} />
                </bdi>
              </span>
            </Link>
          </div>
          <p className="db-summary">{f(m.externalSummary, { n: extTotal })}</p>
          <div className="db-external-bars">
            <StageBars items={extItems} ctx={ctx} idPrefix="db-external" metricPrefix="external" />
          </div>
          <ChartTable
            label={t(m.viewAsTable)}
            head={[t(m.thStage), t(m.thLeads), t(m.thShare)]}
            rows={stageTableRows(extItems, ctx)}
          />
        </section>
      ) : null}
    </Panel>
  );
}
