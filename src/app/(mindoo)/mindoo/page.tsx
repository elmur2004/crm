import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { internalDashboard } from "@/lib/services/metrics";
import { configForBrand } from "@/lib/pipeline-engine/configs/for-brand";
import { formatEGP } from "@/lib/money";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { stageLabel } from "@/lib/i18n/dict/labels";
import { home as m } from "@/lib/i18n/dict/crm";
import { StatCard } from "@/components/shared/StatCard";
import { AnimatedValue } from "@/components/shared/AnimatedValue";
import { stageKey } from "@/components/bsystems/stageColors";

export const metadata = { title: "Home — Mindoo" };

/* ADR-074 — MINDOO'S HOME.

   Founder: "completly identical to byteforce but with no partners or
   regestrations or agents or their crm at all". This screen is where that
   sentence bites hardest, and it is why Mindoo could not simply keep sharing
   B-Systems' Home: that one ENDS in an agent count, a partner count and an
   external-pipeline chart, and every one of those would read zero here forever.
   A dashboard whose bottom third is structurally empty is not a dashboard.

   So it is the four money tiles and the stage strip — the half of the B-Systems
   Home that is about LEADS — and nothing else. The strip walks Mindoo's own
   pipeline (configForBrand), not a hardcoded six, so every column on the board
   has a count here and the two screens cannot disagree about what the stages
   are.

   BackupControls is absent for a different reason: it posts to
   /api/b-systems/backup, which is a B-Systems admin endpoint. Offering a button
   that 403s would be worse than not offering it. */

export default async function MindooHomePage() {
  await requireMindooPage();
  const locale = await getLocale();
  const t = tFor(locale);
  const d = await internalDashboard(MINDOO_SURFACE.brand);
  const config = configForBrand(MINDOO_SURFACE.brand);

  const stageCells = config.stages.map((stage) => ({
    id: stage,
    label: stage === "new" ? t(m.newNotActioned) : stageLabel(locale, stage),
    value:
      stage === "won" ? d.wonCount : stage === "lost" ? d.lostCount : (d.leadsPerStage[stage] ?? 0),
  }));

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
      </div>
      <div className="tile-grid tile-grid--vary">
        <StatCard label={t(m.totalLeads)} value={String(d.totalLeads)} />
        <StatCard
          label={t(m.pipelineValue)}
          value={formatEGP(d.pipelineValue)}
          hint={t(m.activeStagesOnly)}
        />
        <StatCard label={t(m.wonValue)} value={formatEGP(d.wonValue)} />
        <StatCard
          label={t(m.toBeCollected)}
          value={formatEGP(d.toBeCollected)}
          hint={t(m.acrossAllClients)}
        />
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
    </div>
  );
}
