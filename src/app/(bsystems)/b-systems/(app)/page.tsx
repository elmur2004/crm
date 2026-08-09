import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { adminHome } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { formatEGP } from "@/lib/money";
import { StatCard } from "@/components/shared/StatCard";
import { stageAccent } from "@/components/bsystems/stageColors";

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

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Home</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total leads" value={String(d.totalLeads)} />
        <StatCard label="Pipeline value" value={formatEGP(d.pipelineValue)} hint="Active stages only" />
        <StatCard label="Won value" value={formatEGP(d.wonValue)} />
        <StatCard label="To be collected" value={formatEGP(d.toBeCollected)} hint="Across all clients" />
      </div>
      <div>
        <h2 className="text-brand-meta text-brand-muted mb-2">Leads per stage</h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="New / not actioned" value={String(d.leadsPerStage["new"] ?? 0)} />
          <StatCard label="Following Up" value={String(d.leadsPerStage["following_up"] ?? 0)} />
          <StatCard label="Meeting Setting" value={String(d.leadsPerStage["meeting_setting"] ?? 0)} />
          <StatCard label="Sending Proposals" value={String(d.leadsPerStage["sending_proposal"] ?? 0)} />
          <StatCard label="Won" value={String(d.wonCount)} />
          <StatCard label="Lost" value={String(d.lostCount)} />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="grid grid-cols-2 gap-3 md:col-span-1">
          <StatCard label="Agents" value={String(home.agentCount)} />
          <StatCard label="Partners" value={String(home.partnerCount)} />
        </div>
        <div className="md:col-span-2 bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4">
          <h2 className="text-brand-meta text-brand-muted mb-3">
            Agent &amp; partner pipeline
          </h2>
          <div className="space-y-2">
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
