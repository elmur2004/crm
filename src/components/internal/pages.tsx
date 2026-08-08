import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import {
  INTERNAL_STAGES,
  LEAD_TYPE_LABELS,
  STAGE_LABELS,
  type LeadType,
} from "@/lib/pipeline-engine/constants";
import { internalDashboard } from "@/lib/services/metrics";
import { listRepsWithCounts, listReps, countUnassigned } from "@/lib/services/sales-reps";
import { listClients } from "@/lib/services/clients";
import { getLeadDetail, latestProposalValue } from "@/lib/services/leads";
import { formatEGP } from "@/lib/money";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StatCard } from "@/components/shared/StatCard";
import { StageBadge } from "@/components/shared/StageBadge";
import { AddLeadForm, AddRepForm, ClientEditForm } from "./forms";
import { LeadEventPanel } from "./LeadEventPanel";
import { GroupHistory } from "./GroupHistory";
import { HistoryPanel } from "./HistoryPanel";
import { ApiError } from "@/lib/api-error";

/* Brand-parameterized server bodies for the internal CRMs (§6). App A mounts them
   under /byteforce (Phase 1); App B under /b-systems (Phase 2). All data access is
   brand-scoped through the services. */

export interface InternalAppCtx {
  brand: Brand;
  basePath: string; // "/byteforce" | "/b-systems"
  apiBase: string; // "/api/byteforce" | "/api/b-systems"
}

/* ---------------- Home dashboard (§6.5) ---------------- */

export async function DashboardBody({ ctx }: { ctx: InternalAppCtx }) {
  const d = await internalDashboard(ctx.brand);
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
        <h2 className="text-brand-meta text-brand-muted mb-2">
          Leads per stage
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard label="New / not actioned" value={String(d.leadsPerStage["new"] ?? 0)} />
          <StatCard label="Following Up" value={String(d.leadsPerStage["following_up"] ?? 0)} />
          <StatCard label="Meeting Setting" value={String(d.leadsPerStage["meeting_setting"] ?? 0)} />
          <StatCard label="Sending Proposals" value={String(d.leadsPerStage["sending_proposal"] ?? 0)} />
          <StatCard label="Won" value={String(d.wonCount)} />
          <StatCard label="Lost" value={String(d.lostCount)} />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Leads: rep cards grid (§6.1) ---------------- */

export async function LeadsBody({ ctx }: { ctx: InternalAppCtx }) {
  const [reps, unassigned] = await Promise.all([
    listRepsWithCounts(ctx.brand),
    countUnassigned(ctx.brand),
  ]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Leads</h1>
        <AddRepForm apiBase={ctx.apiBase} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {reps.map((rep) => (
          <Link
            key={rep.id}
            href={`${ctx.basePath}/leads/rep/${rep.id}`}
            className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 hover:border-brand-primary"
          >
            <p className="font-bold">{rep.name}</p>
            <p className="text-sm text-brand-muted mt-1">
              {rep.leadCount} lead{rep.leadCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
        {unassigned > 0 ? (
          <Link
            href={`${ctx.basePath}/leads/rep/unassigned`}
            className="bg-brand-surface-tint border border-brand-border rounded-brand-card p-4 hover:border-brand-primary"
          >
            <p className="font-bold">Unassigned (Partner leads)</p>
            <p className="text-sm text-brand-muted mt-1">{unassigned} lead{unassigned === 1 ? "" : "s"}</p>
          </Link>
        ) : null}
        {reps.length === 0 && unassigned === 0 ? (
          <p className="text-sm text-brand-muted col-span-full">
            No sales reps yet — add the first one to start taking leads.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Leads table per rep (§6.1) ---------------- */

export async function RepLeadsBody({ ctx, repId }: { ctx: InternalAppCtx; repId: string }) {
  const isUnassigned = repId === "unassigned";
  const rep = isUnassigned
    ? null
    : await db.salesRep.findFirst({ where: { id: repId, brand: ctx.brand } });
  if (!isUnassigned && !rep) notFound();

  const leads = await db.lead.findMany({
    where: { brand: ctx.brand, salesRepId: isUnassigned ? null : repId },
    orderBy: { createdAt: "desc" },
    include: { partner: { select: { companyName: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <Link href={`${ctx.basePath}/leads`} className="text-sm text-brand-muted underline underline-offset-2">
            Back to all reps
          </Link>
          <h1 className="font-brand-display text-2xl font-bold text-brand-heading">
            {rep ? rep.name : "Unassigned (Partner leads)"}
          </h1>
        </div>
        {!isUnassigned ? <AddLeadForm apiBase={ctx.apiBase} salesRepId={repId} /> : null}
      </div>
      {leads.length === 0 ? (
        <p className="text-sm text-brand-muted">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto border border-brand-border rounded-brand-card bg-brand-surface-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-start">
                <th className="text-start p-3 font-bold">Name</th>
                <th className="text-start p-3 font-bold">Number</th>
                <th className="text-start p-3 font-bold">Type</th>
                <th className="text-start p-3 font-bold">Stage</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b border-brand-border last:border-0 hover:bg-brand-surface-tint">
                  <td className="p-3">
                    <Link href={`${ctx.basePath}/leads/lead/${lead.id}`} className="font-medium text-brand-link">
                      {lead.name}
                    </Link>
                    {lead.partner ? (
                      <span className="ms-2 text-xs bg-brand-secondary text-brand-on-secondary rounded-brand-control px-1.5 py-0.5">
                        Partner: {lead.partner.companyName}
                      </span>
                    ) : null}
                  </td>
                  <td className="p-3">{lead.number}</td>
                  <td className="p-3">{LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}</td>
                  <td className="p-3">
                    <StageBadge stage={lead.stage} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Lead detail (§6.1/§6.2) — same record as the CRM card ---------------- */

export async function LeadDetailBody({ ctx, leadId }: { ctx: InternalAppCtx; leadId: string }) {
  let detail;
  try {
    detail = await getLeadDetail(ctx.brand, leadId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { lead, history } = detail;
  const reps = await listReps(ctx.brand);
  const latestMeeting = lead.meetings.at(-1);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href={`${ctx.basePath}/crm`} className="text-sm text-brand-muted underline underline-offset-2">
            Back to the CRM board
          </Link>
          <h1 className="font-brand-display text-2xl font-bold text-brand-heading flex items-center gap-3 flex-wrap">
            {lead.name}
            <StageBadge stage={lead.stage} />
            {lead.partner ? (
              <span className="text-xs bg-brand-secondary text-brand-on-secondary rounded-brand-control px-2 py-1">
                Partner: {lead.partner.companyName}
              </span>
            ) : null}
          </h1>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
            <p>
              <span className="text-brand-muted">Number:</span> {lead.number}
            </p>
            <p>
              <span className="text-brand-muted">Email:</span> {lead.email ?? "—"}
            </p>
            <p>
              <span className="text-brand-muted">Type:</span>{" "}
              {LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}
            </p>
            <p>
              <span className="text-brand-muted">Assigned rep:</span> {lead.salesRep?.name ?? "Unassigned"}
            </p>
            <p>
              <span className="text-brand-muted">Date created:</span> {formatCairo(lead.createdAt)}
            </p>
            {lead.description ? (
              <p className="pt-1 whitespace-pre-wrap">{lead.description}</p>
            ) : null}
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-3">
              Next action
            </h2>
            <LeadEventPanel
              apiBase={ctx.apiBase}
              leadId={lead.id}
              stage={lead.stage}
              reps={reps.map((r) => ({ id: r.id, name: r.name }))}
              latestProposalValue={latestProposalValue(lead.proposals)}
              hasUnsentProposal={lead.proposals.some((p) => !p.sent)}
              pendingMeeting={Boolean(latestMeeting && latestMeeting.outcome === null && latestMeeting.arranged)}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-brand-meta text-brand-muted mb-2">
              Stage records
            </h2>
            <GroupHistory
              followUps={lead.followUps}
              meetings={lead.meetings}
              proposals={lead.proposals}
              lostInfo={lead.lostInfo}
              won={lead.wonInfo}
            />
          </div>
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-2">
              History
            </h2>
            <HistoryPanel entries={history} />
          </div>
        </section>
      </div>
    </div>
  );
}

/* ---------------- CRM board (§6.3) ---------------- */

/* §6.3 board columns = the engine's stage set minus the intake stage (never
   hardcoded — §5.1). */
const BOARD_STAGES = INTERNAL_STAGES.filter((s) => s !== "new");

export async function CrmBoardBody({ ctx }: { ctx: InternalAppCtx }) {
  const leads = await db.lead.findMany({
    where: { brand: ctx.brand, stage: { in: BOARD_STAGES } },
    include: {
      salesRep: { select: { name: true } },
      partner: { select: { companyName: true } },
      followUps: { orderBy: { createdAt: "desc" }, take: 1 },
      meetings: { orderBy: { createdAt: "desc" }, take: 1 },
      proposals: { orderBy: { createdAt: "desc" }, take: 1 },
      lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
      wonInfo: { select: { estimatedValue: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  function keyDatum(lead: (typeof leads)[number]): string {
    switch (lead.stage) {
      case "following_up":
        return lead.followUps[0] ? `Next: ${formatCairo(lead.followUps[0].dueAt)}` : "No follow-up set";
      case "meeting_setting":
        return lead.meetings[0]?.datetime
          ? `Meeting: ${formatCairo(lead.meetings[0].datetime)}`
          : "Meeting not arranged";
      case "sending_proposal":
        return lead.proposals[0]?.estimatedValue != null
          ? `Est: ${formatEGP(lead.proposals[0].estimatedValue)}`
          : "No value set";
      case "won":
        return lead.wonInfo ? `Est: ${formatEGP(lead.wonInfo.estimatedValue)}` : "";
      case "lost":
        return lead.lostInfo[0]?.reason ?? "";
      default:
        return "";
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">CRM</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
        {BOARD_STAGES.map((stage) => {
          const cards = leads.filter((l) => l.stage === stage);
          return (
            <div key={stage} className="bg-brand-surface-tint rounded-brand-card p-2 min-h-24">
              <p className="text-brand-meta text-brand-muted px-1 pb-2">
                {STAGE_LABELS[stage]} ({cards.length})
              </p>
              <div className="space-y-2">
                {cards.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`${ctx.basePath}/leads/lead/${lead.id}`}
                    className="block bg-brand-surface-card border border-brand-border rounded-brand-card p-3 shadow-brand-card hover:border-brand-primary"
                  >
                    <p className="font-medium text-sm">{lead.name}</p>
                    <p className="text-xs text-brand-muted mt-0.5">
                      {LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}
                      {lead.salesRep ? ` · ${lead.salesRep.name}` : " · Unassigned"}
                    </p>
                    {lead.partner ? (
                      <p className="text-xs mt-1">
                        <span className="bg-brand-secondary text-brand-on-secondary rounded-brand-control px-1.5 py-0.5">
                          Partner: {lead.partner.companyName}
                        </span>
                      </p>
                    ) : null}
                    <p className="text-xs text-brand-ink mt-1">{keyDatum(lead)}</p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Clients (§6.4) ---------------- */

export async function ClientsBody({ ctx }: { ctx: InternalAppCtx }) {
  const clients = await listClients(ctx.brand);
  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Clients</h1>
      {clients.length === 0 ? (
        <p className="text-sm text-brand-muted">No clients yet — they appear automatically when a lead is Won.</p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((c) => (
            <div key={c.id} className="bg-brand-surface-card border border-brand-border rounded-brand-card shadow-brand-card p-4 text-sm space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{c.name}</p>
                {c.retainer ? (
                  <span className="text-xs bg-brand-secondary text-brand-on-secondary rounded-brand-control px-1.5 py-0.5">
                    Retainer
                  </span>
                ) : null}
              </div>
              <p className="text-brand-muted">{c.number}</p>
              <p>
                <span className="text-brand-muted">Service:</span> {c.service ?? "—"}
              </p>
              <p>
                <span className="text-brand-muted">Estimated:</span> {formatEGP(c.estimatedValue)}
              </p>
              <p>
                <span className="text-brand-muted">Collected:</span> {formatEGP(c.collected)}
              </p>
              <p>
                <span className="text-brand-muted">To be collected:</span> {formatEGP(c.toBeCollected)}
                {c.dueDate ? ` (due ${formatCairoDate(c.dueDate)})` : ""}
              </p>
              <p>
                <span className="text-brand-muted">Technical owner:</span> {c.technicalOwner ?? "—"}
              </p>
              <ClientEditForm apiBase={ctx.apiBase} client={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
