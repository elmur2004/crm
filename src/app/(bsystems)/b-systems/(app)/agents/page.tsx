import Link from "next/link";
import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { bsRoleOf } from "@/lib/api/bsystems";
import { listAgentsDetailed, listBsLeads } from "@/lib/services/bsystems-admin";
import { BSYSTEMS_STAGES, STAGE_LABELS } from "@/lib/pipeline-engine/constants";
import { formatCairoDate } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { stageKey } from "@/components/bsystems/stageColors";

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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">B-SYSTEMS · AGENTS</p>
          <h1 className="u-h1">Agents</h1>
        </div>
        <div className="page-actions">
          <nav className="flex gap-1" aria-label="View">
            <Link
              href="/b-systems/agents"
              className="nav-item"
              aria-current={!pipeline ? "page" : undefined}
            >
              Detailed
            </Link>
            <Link
              href="/b-systems/agents?view=pipeline"
              className="nav-item"
              aria-current={pipeline ? "page" : undefined}
            >
              Pipeline
            </Link>
          </nav>
        </div>
      </div>

      {pipeline ? <AgentsPipeline /> : <AgentsDetailed />}
    </div>
  );
}

async function AgentsDetailed() {
  const agents = await listAgentsDetailed();
  if (agents.length === 0) {
    return <p className="empty">No agents have signed up yet.</p>;
  }
  return (
    <div className="space-y-4">
      {agents.map((a) => (
        <div key={a.id} className="card card--flush0">
          <div className="identity-head">
            <div className="space-y-0.5">
              <p className="identity-name">
                {a.firstName} {a.lastName}
                {!a.user.active ? (
                  <span className="ms-2 badge badge--danger align-middle">
                    Deactivated
                  </span>
                ) : null}
              </p>
              <p className="identity-sub">{a.speciality}</p>
              <p className="u-muted">
                <span>Phone:</span> {a.user.phone ?? "—"}
              </p>
              <p className="u-muted">
                <span>Address:</span> {a.address}
              </p>
            </div>
            <p className="text-brand-meta text-brand-muted">
              Joined {formatCairoDate(a.user.createdAt)}
            </p>
          </div>
          {a.user.ownedLeads.length === 0 ? (
            <p className="u-muted card-pad">No leads yet.</p>
          ) : (
            <div className="table-scroll">
              <table className="table table--embedded">
                <thead>
                  <tr>
                    <th>Lead</th>
                    <th>Number</th>
                    <th>Stage</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {a.user.ownedLeads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <Link href={`/b-systems/crm/lead/${l.id}`} className="td-title">
                          {l.name}
                        </Link>
                      </td>
                      <td className="td-mono">{l.number}</td>
                      <td>
                        <StageBadge stage={l.stage} />
                      </td>
                      <td>{formatCairoDate(l.createdAt)}</td>
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
    <div className="board" data-cols="6plus">
      {BSYSTEMS_STAGES.map((stage) => {
        const cards = leads.filter((l) => l.stage === stage);
        return (
          <div key={stage} className="col" data-stage-key={stageKey(stage)}>
            <div className="col-bar" aria-hidden />
            <div className="col-head">
              <p className="col-title">
                {STAGE_LABELS[stage]} ({cards.length})
              </p>
            </div>
            <div className="col-cards">
              {cards.map((l) => (
                <Link key={l.id} href={`/b-systems/crm/lead/${l.id}`} className="bcard block">
                  <p className="bcard-name">{l.name}</p>
                  <p className="bcard-rep mt-0.5">{l.owner?.name ?? "—"}</p>
                </Link>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
