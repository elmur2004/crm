import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { adminHome } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { formatEGP } from "@/lib/money";
import { StatCard } from "@/components/shared/StatCard";
import { stageAccent, stageKey } from "@/components/bsystems/stageColors";

export const metadata = { title: "Home — B-Systems CRM" };

/* V2 §2.1 — admin Home: the v1 dashboard + agent/partner counts + their leads'
   pipeline chart. Non-admins land on their CRM board. */

export default async function BSystemsHomePage() {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const home = await adminHome();
  const d = home.base;
  const maxCount = Math.max(1, ...Object.values(home.externalPipeline));

  const stageCells: Array<{ id: string; label: string; value: number }> = [
    { id: "new", label: "New / not actioned", value: d.leadsPerStage["new"] ?? 0 },
    { id: "following_up", label: "Following Up", value: d.leadsPerStage["following_up"] ?? 0 },
    { id: "meeting_setting", label: "Meeting Setting", value: d.leadsPerStage["meeting_setting"] ?? 0 },
    { id: "sending_proposal", label: "Sending Proposals", value: d.leadsPerStage["sending_proposal"] ?? 0 },
    { id: "won", label: "Won", value: d.wonCount },
    { id: "lost", label: "Lost", value: d.lostCount },
  ];

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · HOME</p>
          <h1 className="u-h1">Home</h1>
        </div>
      </div>
      <div className="tile-grid">
        <StatCard label="Total leads" value={String(d.totalLeads)} />
        <StatCard label="Pipeline value" value={formatEGP(d.pipelineValue)} hint="Active stages only" />
        <StatCard label="Won value" value={formatEGP(d.wonValue)} />
        <StatCard label="To be collected" value={formatEGP(d.toBeCollected)} hint="Across all clients" />
      </div>
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">Leads per stage</h2>
        </div>
        <div className="stage-strip">
          {stageCells.map((cell) => (
            <div key={cell.id} className="stage-cell" data-stage-key={stageKey(cell.id)}>
              <div className="stage-cell-bar" aria-hidden />
              <p className="stage-cell-label">{cell.label}</p>
              <p className="stage-cell-value">{cell.value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="tile-grid md:col-span-1">
          <StatCard label="Agents" value={String(home.agentCount)} />
          <StatCard label="Partners" value={String(home.partnerCount)} />
        </div>
        <div className="md:col-span-2 card card--flush0">
          <div className="card-head">
            <h2 className="u-h3">
              Agent &amp; partner pipeline
            </h2>
          </div>
          <div className="card-pad space-y-2">
            {BSYSTEMS_STAGES.map((stage) => {
              const count = home.externalPipeline[stage] ?? 0;
              return (
                <div key={stage} className="flex items-center gap-3 text-sm">
                  <span className="w-36 shrink-0 text-brand-muted">{STAGE_LABELS[stage]}</span>
                  <div className="flex-1 bg-brand-surface-tint rounded-brand-control h-4 overflow-hidden">
                    <div
                      className={`h-full ${stageAccent(stage)}`}
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-end font-medium">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
