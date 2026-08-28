import { redirect } from "next/navigation";
import { requireCompanyPage } from "@/lib/auth/page-guards";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { crmHomeFor } from "@/lib/crm/nav";
import { crmQuery } from "@/lib/crm/company";
import { DashboardBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "./ctx";
import { adminHome } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES } from "@/lib/pipeline-engine/constants";
import { formatEGP } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { home as m } from "@/lib/i18n/dict/crm";
import { StatCard } from "@/components/shared/StatCard";
import { AnimatedValue } from "@/components/shared/AnimatedValue";
import { BackupControls } from "@/components/bsystems/backup";
import { stageAccent, stageKey } from "@/components/bsystems/stageColors";

export const metadata = { title: "Home — B-Systems CRM" };

/* V2 §2.1 — admin Home: the v1 dashboard + agent/partner counts + their leads'
   pipeline chart. Non-admins land on their CRM board.

   ADR-067 — one of the FOUR addresses both companies share, so it branches on
   the company before it does anything else. Under ByteForce it is the ByteForce
   dashboard (brand-scoped metrics, no partner/agent counts — those are
   B-Systems concepts and must never render on a ByteForce Home). */

export default async function BSystemsHomePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const { user, company } = await requireCompanyPage((await searchParams).company);
  if (company === "byteforce") return <DashboardBody ctx={BYTEFORCE_CTX} />;

  const role = bsRoleOrNull(user);
  /* the role's own first destination, which by construction accepts
     company=bsystems and this role — so the bounce cannot ping-pong */
  if (role !== "bsystems_admin") redirect(`${crmHomeFor("bsystems", role)}${crmQuery("bsystems")}`);

  const locale = await getLocale();
  const t = tFor(locale);
  const home = await adminHome();
  const d = home.base;
  const maxCount = Math.max(1, ...Object.values(home.externalPipeline));

  const stageCells: Array<{ id: string; label: string; value: number }> = [
    { id: "new", label: t(m.newNotActioned), value: d.leadsPerStage["new"] ?? 0 },
    { id: "following_up", label: stageLabel(locale, "following_up"), value: d.leadsPerStage["following_up"] ?? 0 },
    { id: "meeting_setting", label: stageLabel(locale, "meeting_setting"), value: d.leadsPerStage["meeting_setting"] ?? 0 },
    { id: "sending_proposal", label: stageLabel(locale, "sending_proposal"), value: d.leadsPerStage["sending_proposal"] ?? 0 },
    { id: "won", label: stageLabel(locale, "won"), value: d.wonCount },
    { id: "lost", label: stageLabel(locale, "lost"), value: d.lostCount },
  ];

  const today = new Date().toLocaleDateString(locale === "ar" ? "ar-EG" : "en-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Cairo",
  });

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(m.eyebrow)}</p>
          <h1 className="u-h1">{t(m.title)}</h1>
          <p className="u-sub">{today}</p>
        </div>
        <div className="page-actions">
          <BackupControls />
        </div>
      </div>
      <div className="tile-grid tile-grid--vary">
        <StatCard label={t(m.totalLeads)} value={String(d.totalLeads)} />
        <StatCard label={t(m.pipelineValue)} value={formatEGP(d.pipelineValue)} hint={t(m.activeStagesOnly)} />
        <StatCard label={t(m.wonValue)} value={formatEGP(d.wonValue)} />
        <StatCard label={t(m.toBeCollected)} value={formatEGP(d.toBeCollected)} hint={t(m.acrossAllClients)} />
      </div>
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">{t(m.leadsPerStage)}</h2>
        </div>
        <div className="stage-strip">
          {stageCells.map((cell) => (
            <div key={cell.id} className="stage-cell" data-stage-key={stageKey(cell.id)}>
              <div className="stage-cell-bar" aria-hidden />
              <p className="stage-cell-label">{cell.label}</p>
              <p className="stage-cell-value">
                <AnimatedValue value={String(cell.value)} />
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="tile-grid md:col-span-1">
          <StatCard label={t(m.agents)} value={String(home.agentCount)} />
          <StatCard label={t(m.partners)} value={String(home.partnerCount)} />
        </div>
        <div className="md:col-span-2 card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">
              {t(m.externalPipeline)}
            </h2>
          </div>
          <div className="card-pad space-y-1">
            {BSYSTEMS_STAGES.map((stage, i) => {
              const count = home.externalPipeline[stage] ?? 0;
              return (
                <div key={stage} className="chart-row text-sm">
                  <span className="w-36 shrink-0 text-brand-muted">{stageLabel(locale, stage)}</span>
                  <div className="meter">
                    <div
                      className={`meter-fill ${stageAccent(stage)}`}
                      style={{
                        width: `${(count / maxCount) * 100}%`,
                        animationDelay: `${i * 70}ms`,
                      }}
                    />
                  </div>
                  <span className="w-8 text-end font-medium">
                    <AnimatedValue value={String(count)} />
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
