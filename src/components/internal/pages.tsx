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
import { stageKey } from "@/components/bsystems/stageColors";
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

/* Mono eyebrow context line per brand (design spec §2.2 — additive, not a reword). */
const BRAND_EYEBROW: Record<Brand, string> = {
  byteforce: "BYTEFORCE",
  bsystems: "B-SYSTEMS",
};

/* Decorative initials for entity-card marks (aria-hidden, spec §2.4). */
function markInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

/* ---------------- Home dashboard (§6.5) ---------------- */

export async function DashboardBody({ ctx }: { ctx: InternalAppCtx }) {
  const d = await internalDashboard(ctx.brand);
  const stageCells: Array<{ key: string; label: string; value: string }> = [
    { key: "intake", label: "New / not actioned", value: String(d.leadsPerStage["new"] ?? 0) },
    { key: "following", label: "Following Up", value: String(d.leadsPerStage["following_up"] ?? 0) },
    { key: "meeting", label: "Meeting Setting", value: String(d.leadsPerStage["meeting_setting"] ?? 0) },
    { key: "proposal", label: "Sending Proposals", value: String(d.leadsPerStage["sending_proposal"] ?? 0) },
    { key: "won", label: "Won", value: String(d.wonCount) },
    { key: "lost", label: "Lost", value: String(d.lostCount) },
  ];
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · HOME</p>
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
          <h2 className="u-h3">
            Leads per stage
          </h2>
        </div>
        <div className="stage-strip">
          {stageCells.map((cell) => (
            <div key={cell.key} className="stage-cell" data-stage-key={cell.key}>
              <div className="stage-cell-bar" aria-hidden />
              <p className="stage-cell-label">{cell.label}</p>
              <p className="stage-cell-value">{cell.value}</p>
            </div>
          ))}
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · LEADS</p>
          <h1 className="u-h1">Leads</h1>
        </div>
        <div className="page-actions">
          <AddRepForm apiBase={ctx.apiBase} />
        </div>
      </div>
      <div className="ecard-grid">
        {reps.map((rep) => (
          <Link key={rep.id} href={`${ctx.basePath}/leads/rep/${rep.id}`} className="ecard">
            <div className="ecard-top">
              <span className="ecard-mark" aria-hidden>
                {markInitials(rep.name)}
              </span>
            </div>
            <p className="ecard-title">{rep.name}</p>
            <p className="ecard-sub">
              {rep.leadCount} lead{rep.leadCount === 1 ? "" : "s"}
            </p>
          </Link>
        ))}
        {unassigned > 0 ? (
          <Link href={`${ctx.basePath}/leads/rep/unassigned`} className="ecard ecard--accent">
            <div className="ecard-top">
              <span className="ecard-mark" aria-hidden>
                U
              </span>
            </div>
            <p className="ecard-title">Unassigned (Partner leads)</p>
            <p className="ecard-sub">{unassigned} lead{unassigned === 1 ? "" : "s"}</p>
          </Link>
        ) : null}
        {reps.length === 0 && unassigned === 0 ? (
          <p className="empty col-span-full">
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
      <div className="page-head">
        <div>
          <Link href={`${ctx.basePath}/leads`} className="text-sm text-brand-muted underline underline-offset-2">
            Back to all reps
          </Link>
          <h1 className="u-h1">
            {rep ? rep.name : "Unassigned (Partner leads)"}
          </h1>
        </div>
        <div className="page-actions">
          {!isUnassigned ? <AddLeadForm apiBase={ctx.apiBase} salesRepId={repId} /> : null}
        </div>
      </div>
      {leads.length === 0 ? (
        <p className="empty">No leads yet.</p>
      ) : (
        <div className="card card--flush0">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Number</th>
                  <th>Type</th>
                  <th>Stage</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <Link href={`${ctx.basePath}/leads/lead/${lead.id}`} className="td-title">
                        {lead.name}
                      </Link>
                      {lead.partner ? (
                        <span className="badge badge--partner ms-2">
                          Partner: {lead.partner.companyName}
                        </span>
                      ) : null}
                    </td>
                    <td className="td-mono">{lead.number}</td>
                    <td>
                      <span className="chip-outline">{LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}</span>
                    </td>
                    <td>
                      <StageBadge stage={lead.stage} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      <div>
        <Link href={`${ctx.basePath}/crm`} className="text-sm text-brand-muted underline underline-offset-2">
          Back to the CRM board
        </Link>
      </div>

      <div className="card card--flush0">
        <div className="identity-head">
          <h1 className="identity-name flex items-center gap-3 flex-wrap">
            {lead.name}
            <StageBadge stage={lead.stage} header />
            {lead.partner ? (
              <span className="badge badge--partner">
                Partner: {lead.partner.companyName}
              </span>
            ) : null}
          </h1>
        </div>
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-label">Number:</p>
            <p className="fields-value">{lead.number}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">Email:</p>
            <p className="fields-value">{lead.email ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">Type:</p>
            <p className="fields-value">{LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">Assigned rep:</p>
            <p className="fields-value">{lead.salesRep?.name ?? "Unassigned"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">Date created:</p>
            <p className="fields-value">{formatCairo(lead.createdAt)}</p>
          </div>
          {lead.description ? (
            <div className="fields-cell col-span-full">
              <p className="fields-value whitespace-pre-wrap">{lead.description}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6 items-start">
        <section className="space-y-4">
          <div className="card card--flush0">
            <div className="card-head">
              <h2 className="u-h3">
                Next action
              </h2>
            </div>
            <div className="card-pad">
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
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="u-h3 mb-2">
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
          <div className="card card--flush0">
            <div className="card-head">
              <h2 className="u-h3">
                History
              </h2>
            </div>
            <div className="card-pad">
              <HistoryPanel entries={history} />
            </div>
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · CRM</p>
          <h1 className="u-h1">CRM</h1>
        </div>
      </div>
      <div className="board" data-cols="6plus">
        {BOARD_STAGES.map((stage) => {
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
                {cards.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`${ctx.basePath}/leads/lead/${lead.id}`}
                    className="bcard block"
                  >
                    <p className="bcard-name">{lead.name}</p>
                    <p className="bcard-rep mt-1">
                      {LEAD_TYPE_LABELS[lead.type as LeadType] ?? lead.type}
                      {lead.salesRep ? ` · ${lead.salesRep.name}` : " · Unassigned"}
                    </p>
                    {lead.partner ? (
                      <p className="mt-2">
                        <span className="bcard-badge">
                          Partner: {lead.partner.companyName}
                        </span>
                      </p>
                    ) : null}
                    <p className="bcard-meta">
                      <span className="bcard-meta-dot" aria-hidden />
                      {keyDatum(lead)}
                    </p>
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
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · CLIENTS</p>
          <h1 className="u-h1">Clients</h1>
        </div>
      </div>
      {clients.length === 0 ? (
        <p className="empty">No clients yet — they appear automatically when a lead is Won.</p>
      ) : (
        <div className="ecard-grid">
          {clients.map((c) => (
            <div key={c.id} className="ecard cursor-auto">
              <div className="ecard-top">
                <span className="ecard-mark" aria-hidden>
                  {markInitials(c.name)}
                </span>
                {c.retainer ? (
                  <span className="ecard-chip">
                    Retainer
                  </span>
                ) : null}
              </div>
              <p className="ecard-title">{c.name}</p>
              <p className="ecard-sub">{c.number}</p>
              <p className="ecard-sub">
                <span>Service:</span> {c.service ?? "—"}
              </p>
              <div className="ecard-stats">
                <div>
                  <p className="ecard-stat-label">Estimated:</p>
                  <p className="ecard-stat-value">{formatEGP(c.estimatedValue)}</p>
                </div>
                <div>
                  <p className="ecard-stat-label">Collected:</p>
                  <p className="ecard-stat-value">{formatEGP(c.collected)}</p>
                </div>
                <div>
                  <p className="ecard-stat-label">To be collected:</p>
                  <p className="ecard-stat-value">
                    {formatEGP(c.toBeCollected)}
                    {c.dueDate ? ` (due ${formatCairoDate(c.dueDate)})` : ""}
                  </p>
                </div>
              </div>
              <p className="ecard-footer">
                <span>Technical owner:</span> {c.technicalOwner ?? "—"}
              </p>
              <ClientEditForm apiBase={ctx.apiBase} client={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
