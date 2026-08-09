import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listAgentsDetailed, listBsLeads } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { stageAccent, stageTint } from "@/components/bsystems/stageColors";

export const metadata = { title: "Agents — B-Systems CRM" };

/* V2 §2.7 — Agents, like Partners: a Detailed view (profile cards + join date +
   leads table) and a Pipeline view (their leads across the stages). */

export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (bsRoleOf(user) !== "bsystems_admin") redirect("/b-systems/crm");

  const { view } = await searchParams;
  const pipeline = view === "pipeline";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Agents</h1>
        <nav className="flex gap-1" aria-label="View">
          <Link
            href="/b-systems/agents"
            className={`px-3 py-1.5 rounded-brand-control text-sm font-medium ${
              !pipeline ? "bg-brand-primary text-brand-on-primary" : "text-brand-link hover:bg-brand-surface-tint"
            }`}
          >
            Detailed
          </Link>
          <Link
            href="/b-systems/agents?view=pipeline"
            className={`px-3 py-1.5 rounded-brand-control text-sm font-medium ${
              pipeline ? "bg-brand-primary text-brand-on-primary" : "text-brand-link hover:bg-brand-surface-tint"
            }`}
          >
            Pipeline
          </Link>
        </nav>
      </div>

      {pipeline ? <AgentsPipeline /> : <AgentsDetailed />}
    </div>
  );
}

async function AgentsDetailed() {
  const agents = await listAgentsDetailed();
  if (agents.length === 0) {
    return <p className="text-sm text-brand-muted">No agents have signed up yet.</p>;
  }
  return (
    <div className="space-y-4">
      {agents.map((a) => (
        <div
          key={a.id}
          className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4"
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="text-sm space-y-0.5">
              <p className="font-bold text-base">
                {a.firstName} {a.lastName}
                {!a.user.active ? (
                  <span className="ms-2 text-xs bg-brand-danger text-brand-on-danger rounded-brand-control px-1.5 py-0.5">
                    Deactivated
                  </span>
                ) : null}
              </p>
              <p className="text-brand-muted">{a.speciality}</p>
              <p>
                <span className="text-brand-muted">Phone:</span> {a.user.phone ?? "—"}
              </p>
              <p>
                <span className="text-brand-muted">Address:</span> {a.address}
              </p>
            </div>
            <p className="text-brand-meta text-brand-muted">
              Joined {formatCairoDate(a.user.createdAt)}
            </p>
          </div>
          {a.user.ownedLeads.length === 0 ? (
            <p className="text-sm text-brand-muted mt-3">No leads yet.</p>
          ) : (
            <div className="overflow-x-auto mt-3 border border-brand-border rounded-brand-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-brand-border">
                    <th className="text-start p-2 font-bold">Lead</th>
                    <th className="text-start p-2 font-bold">Number</th>
                    <th className="text-start p-2 font-bold">Stage</th>
                    <th className="text-start p-2 font-bold">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {a.user.ownedLeads.map((l) => (
                    <tr key={l.id} className="border-b border-brand-border last:border-0">
                      <td className="p-2">
                        <Link href={`/b-systems/crm/lead/${l.id}`} className="text-brand-link font-medium">
                          {l.name}
                        </Link>
                      </td>
                      <td className="p-2">{l.number}</td>
                      <td className="p-2">
                        <StageBadge stage={l.stage} />
                      </td>
                      <td className="p-2">{formatCairoDate(l.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

async function AgentsPipeline() {
  const leads = await listBsLeads("agent");
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3 items-start">
      {BSYSTEMS_STAGES.map((stage) => {
        const cards = leads.filter((l) => l.stage === stage);
        return (
          <div key={stage} className={`rounded-brand-card min-h-24 overflow-hidden ${stageTint(stage)}`}>
            <div className={`h-1.5 ${stageAccent(stage)}`} aria-hidden />
            <div className="p-2">
              <p className="text-brand-meta text-brand-muted px-1 pb-2">
                {STAGE_LABELS[stage]} ({cards.length})
              </p>
              <div className="space-y-2">
                {cards.map((l) => (
                  <Link
                    key={l.id}
                    href={`/b-systems/crm/lead/${l.id}`}
                    className="block bg-brand-surface-card border border-brand-border rounded-brand-card p-3 shadow-brand-card hover:border-brand-primary"
                  >
                    <p className="font-medium text-sm">{l.name}</p>
                    <p className="text-xs text-brand-muted mt-0.5">{l.owner?.name ?? "—"}</p>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
