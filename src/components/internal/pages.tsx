import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { INTERNAL_STAGES, LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, stageLabel } from "@/lib/i18n/dict/labels";
import {
  board,
  clientsPage,
  common,
  dash,
  leadDetail,
  leadsPage,
  nav,
} from "@/lib/i18n/dict/internal";
import { internalDashboard } from "@/lib/services/metrics";
import {
  listRepsWithCounts,
  listReps,
  countUnassigned,
  countUnassignedArchived,
} from "@/lib/services/sales-reps";
import { listClients } from "@/lib/services/clients";
import { getLeadDetail, latestProposalValue } from "@/lib/services/leads";
import { formatEGP } from "@/lib/money";
import { formatCairo, formatCairoDate } from "@/lib/datetime";
import { StatCard } from "@/components/shared/StatCard";
import { AnimatedValue } from "@/components/shared/AnimatedValue";
import { StageBadge } from "@/components/shared/StageBadge";
import { stageKey } from "@/components/bsystems/stageColors";
import { AddLeadForm, AddRepForm, ClientEditForm } from "./forms";
import { LeadChat } from "@/components/shared/LeadChat";
import { listLeadComments, mentionableUsersFor } from "@/lib/services/comments";
import { requireLeadAccess } from "@/lib/auth/guards";
import {
  archiveMsgs,
  common as crmCommon,
  leadsFilters,
  ownerFilters,
} from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
import { FilterPanel } from "@/components/shared/FilterPanel";
import { leadSearchWhere, leadTypeWhere } from "@/lib/services/lead-search";
import { ArchiveButton } from "@/components/shared/ArchiveButton";
import { LeadEventPanel } from "./LeadEventPanel";
import { InternalBoard, type InternalBoardLead } from "./InternalBoard";
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
  const locale = await getLocale();
  const t = tFor(locale);
  const d = await internalDashboard(ctx.brand);
  const stageCells: Array<{ key: string; label: string; value: string }> = [
    { key: "intake", label: t(dash.newNotActioned), value: String(d.leadsPerStage["new"] ?? 0) },
    { key: "following", label: stageLabel(locale, "following_up"), value: String(d.leadsPerStage["following_up"] ?? 0) },
    { key: "meeting", label: stageLabel(locale, "meeting_setting"), value: String(d.leadsPerStage["meeting_setting"] ?? 0) },
    { key: "proposal", label: stageLabel(locale, "sending_proposal"), value: String(d.leadsPerStage["sending_proposal"] ?? 0) },
    { key: "won", label: stageLabel(locale, "won"), value: String(d.wonCount) },
    { key: "lost", label: stageLabel(locale, "lost"), value: String(d.lostCount) },
  ];
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · {t(dash.eyebrowHome)}</p>
          <h1 className="u-h1">{t(nav.home)}</h1>
        </div>
      </div>
      <div className="tile-grid tile-grid--vary">
        <StatCard label={t(dash.totalLeads)} value={String(d.totalLeads)} />
        <StatCard label={t(dash.pipelineValue)} value={formatEGP(d.pipelineValue)} hint={t(dash.activeStagesOnly)} />
        <StatCard label={t(dash.wonValue)} value={formatEGP(d.wonValue)} />
        <StatCard label={t(dash.toBeCollected)} value={formatEGP(d.toBeCollected)} hint={t(dash.acrossAllClients)} />
      </div>
      <div className="card card--flush0">
        <div className="card-head">
          <h2 className="u-h3">
            {t(dash.leadsPerStage)}
          </h2>
        </div>
        <div className="stage-strip">
          {stageCells.map((cell) => (
            <div key={cell.key} className="stage-cell" data-stage-key={cell.key}>
              <div className="stage-cell-bar" aria-hidden />
              <p className="stage-cell-label">{cell.label}</p>
              <p className="stage-cell-value"><AnimatedValue value={String(cell.value)} /></p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Leads: rep cards grid (§6.1) ---------------- */

export async function LeadsBody({ ctx }: { ctx: InternalAppCtx }) {
  const locale = await getLocale();
  const t = tFor(locale);
  const [reps, unassigned, unassignedArchived] = await Promise.all([
    listRepsWithCounts(ctx.brand),
    countUnassigned(ctx.brand),
    countUnassignedArchived(ctx.brand),
  ]);
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · {t(leadsPage.eyebrowLeads)}</p>
          <h1 className="u-h1">{t(nav.leads)}</h1>
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
              {rep.leadCount} {rep.leadCount === 1 ? t(leadsPage.leadOne) : t(leadsPage.leadMany)}
            </p>
          </Link>
        ))}
        {unassigned > 0 || unassignedArchived > 0 ? (
          <Link href={`${ctx.basePath}/leads/rep/unassigned`} className="ecard ecard--accent">
            <div className="ecard-top">
              <span className="ecard-mark" aria-hidden>
                U
              </span>
            </div>
            <p className="ecard-title">{t(leadsPage.unassignedPartnerLeads)}</p>
            <p className="ecard-sub">{unassigned} {unassigned === 1 ? t(leadsPage.leadOne) : t(leadsPage.leadMany)}</p>
          </Link>
        ) : null}
        {reps.length === 0 && unassigned === 0 && unassignedArchived === 0 ? (
          <p className="empty col-span-full">
            {t(leadsPage.noRepsYet)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ---------------- Leads table per rep (§6.1) ---------------- */

export async function RepLeadsBody({
  ctx,
  repId,
  archived = false,
}: {
  ctx: InternalAppCtx;
  repId: string;
  archived?: boolean;
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const isUnassigned = repId === "unassigned";
  const rep = isUnassigned
    ? null
    : await db.salesRep.findFirst({ where: { id: repId, brand: ctx.brand } });
  if (!isUnassigned && !rep) notFound();

  /* ADR-043: the default view hides archived leads; ?view=archived IS the
     archive (unarchive lives on the lead detail). */
  const leads = await db.lead.findMany({
    where: { brand: ctx.brand, salesRepId: isUnassigned ? null : repId, archived },
    orderBy: { createdAt: "desc" },
    include: { partner: { select: { companyName: true } } },
  });

  const basePath = `${ctx.basePath}/leads/rep/${repId}`;
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <Link href={`${ctx.basePath}/leads`} className="text-sm text-brand-muted underline underline-offset-2">
            {t(leadsPage.backToAllReps)}
          </Link>
          <h1 className="u-h1">
            {rep ? rep.name : t(leadsPage.unassignedPartnerLeads)}
          </h1>
        </div>
        <div className="page-actions">
          <nav className="flex gap-1 flex-wrap" aria-label={t(archiveMsgs.archived)}>
            <Link href={basePath} className="nav-item" aria-current={archived ? undefined : "page"}>
              {t(archiveMsgs.active)}
            </Link>
            <Link
              href={`${basePath}?view=archived`}
              className="nav-item"
              aria-current={archived ? "page" : undefined}
            >
              {t(archiveMsgs.archived)}
            </Link>
          </nav>
          {!isUnassigned ? <AddLeadForm apiBase={ctx.apiBase} salesRepId={repId} /> : null}
        </div>
      </div>
      {leads.length === 0 ? (
        <p className="empty">{t(leadsPage.noLeadsYet)}</p>
      ) : (
        <div className="card card--flush0">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>{t(leadsPage.thName)}</th>
                  <th>{t(leadsPage.thNumber)}</th>
                  <th>{t(leadsPage.thType)}</th>
                  <th>{t(leadsPage.thStage)}</th>
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
                          {t(common.partnerPrefix)} {lead.partner.companyName}
                        </span>
                      ) : null}
                    </td>
                    <td className="td-mono">{lead.number}</td>
                    <td>
                      <span className="chip-outline">{leadTypeLabel(locale, lead.type)}</span>
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
  const locale = await getLocale();
  const t = tFor(locale);
  let detail;
  let access;
  try {
    detail = await getLeadDetail(ctx.brand, leadId);
    access = await requireLeadAccess(leadId);
  } catch (e) {
    if (e instanceof ApiError) notFound();
    throw e;
  }
  const { lead, history } = detail;
  const [reps, comments, mentionables] = await Promise.all([
    listReps(ctx.brand),
    listLeadComments(leadId),
    mentionableUsersFor(leadId),
  ]);
  const latestMeeting = lead.meetings.at(-1);

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <Link href={`${ctx.basePath}/crm`} className="text-sm text-brand-muted underline underline-offset-2">
            {t(leadDetail.backToBoard)}
          </Link>
        </div>
        <div className="page-actions">
          {/* founder: the dial entry point — opens the phone-first call sheet.
              PRIMARY, not accent: calling the lead is the page's one true
              action, and accent is already the Ready-to-close cue here. */}
          <Link href={`${ctx.basePath}/leads/lead/${lead.id}/call`} className="btn-primary">
            {t(callSheet.navLabel)}
          </Link>
          <ArchiveButton
            postUrl={`${ctx.apiBase}/leads/${lead.id}/archive`}
            archived={lead.archived}
          />
        </div>
      </div>

      <div className="card card--flush0">
        <div className="identity-head">
          <h1 className="identity-name flex items-center gap-3 flex-wrap">
            {lead.name}
            <StageBadge stage={lead.stage} header />
            {lead.partner ? (
              <span className="badge badge--partner">
                {t(common.partnerPrefix)} {lead.partner.companyName}
              </span>
            ) : null}
            {lead.noAnswer ? (
              <span className="badge badge--noanswer">{t(crmCommon.noAnswer)}</span>
            ) : null}
            {lead.archived ? (
              <span className="badge badge--archived">{t(archiveMsgs.archived)}</span>
            ) : null}
          </h1>
        </div>
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-label">{t(leadDetail.numberColon)}</p>
            <p className="fields-value">{lead.number}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(leadDetail.emailColon)}</p>
            <p className="fields-value">{lead.email ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(leadDetail.typeColon)}</p>
            <p className="fields-value">{leadTypeLabel(locale, lead.type)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(leadDetail.assignedRepColon)}</p>
            <p className="fields-value">{lead.salesRep?.name ?? t(common.unassigned)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(leadDetail.dateCreatedColon)}</p>
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
                {t(leadDetail.nextAction)}
              </h2>
            </div>
            <div className="card-pad">
              {/* ADR-043 hardening: archived = read-only (the API rejects
                  events too); the chat below stays open. */}
              {lead.archived ? (
                <p className="u-muted">{t(archiveMsgs.archivedNote)}</p>
              ) : (
                <LeadEventPanel
                  apiBase={ctx.apiBase}
                  leadId={lead.id}
                  stage={lead.stage}
                  reps={reps.map((r) => ({ id: r.id, name: r.name }))}
                  latestProposalValue={latestProposalValue(lead.proposals)}
                  hasUnsentProposal={lead.proposals.some((p) => !p.sent)}
                  pendingMeeting={Boolean(latestMeeting && latestMeeting.outcome === null && latestMeeting.arranged)}
                />
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          {/* founder: the mini chat — questions, follow-ups, @mentions */}
          <LeadChat
            postUrl={`${ctx.apiBase}/leads/${lead.id}/comments`}
            comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
            mentionables={mentionables}
            currentUserId={access.user.id}
          />
          <div>
            <h2 className="u-h3 mb-2">
              {t(leadDetail.stageRecords)}
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
                {t(leadDetail.history)}
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

/* §6.3 defined five columns (minus intake) — the founder overrode it: "I added
   a lead and it's still very empty." The board now shows EVERY lead, so intake
   ("new") gets its own leading column like the B-Systems board (ADR-040). The
   stage set still comes from the engine, never hardcoded (§5.1). */
const BOARD_STAGES = [...INTERNAL_STAGES];

/* Founder (filters round 3): the same search/type narrowing the B-Systems board
   got — Search + Type only here (ByteForce has no owner buckets; reps have their
   own pages). Server-side, through the shared lead-search helpers. */
export async function CrmBoardBody({
  ctx,
  params,
}: {
  ctx: InternalAppCtx;
  params?: { q?: string; type?: string };
}) {
  const locale = await getLocale();
  const t = tFor(locale);
  const search = (params?.q ?? "").trim();
  const type = (LEAD_TYPES as readonly string[]).includes(params?.type ?? "")
    ? params!.type!
    : "any";
  const activeCount = [search !== "", type !== "any"].filter(Boolean).length;
  const leads = await db.lead.findMany({
    where: {
      brand: ctx.brand,
      archived: false,
      stage: { in: BOARD_STAGES },
      ...leadSearchWhere(search),
      ...leadTypeWhere(type),
    },
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
      case "new":
        return formatCairo(lead.createdAt); // intake cards show when they arrived
      case "following_up":
        return lead.followUps[0]
          ? `${t(board.nextPrefix)} ${formatCairo(lead.followUps[0].dueAt)}`
          : t(board.noFollowUpSet);
      case "meeting_setting":
        return lead.meetings[0]?.datetime
          ? `${t(board.meetingPrefix)} ${formatCairo(lead.meetings[0].datetime)}`
          : t(board.meetingNotArranged);
      case "sending_proposal":
        return lead.proposals[0]?.estimatedValue != null
          ? `${t(board.estPrefix)} ${formatEGP(lead.proposals[0].estimatedValue)}`
          : t(common.noValueSet);
      case "won":
        return lead.wonInfo ? `${t(board.estPrefix)} ${formatEGP(lead.wonInfo.estimatedValue)}` : "";
      case "lost":
        return lead.lostInfo[0]?.reason ?? "";
      default:
        return "";
    }
  }

  /* Founder (ADR-042): full parity with the B-Systems board — the client
     board handles drag + the drop-opens-stage-form modal + the didn't-answer
     marker. Labels are precomputed here so the client stays string-free. */
  const reps = (await listReps(ctx.brand)).map((r) => ({ id: r.id, name: r.name }));
  const cards: InternalBoardLead[] = leads.map((lead) => ({
    id: lead.id,
    name: lead.name,
    subtitle: `${leadTypeLabel(locale, lead.type)} · ${lead.salesRep ? lead.salesRep.name : t(common.unassigned)}`,
    partnerBadge: lead.partner ? `${t(common.partnerPrefix)} ${lead.partner.companyName}` : null,
    stage: lead.stage,
    keyDatum: keyDatum(lead),
    noAnswer: lead.noAnswer,
    latestProposalValue: lead.proposals[0]?.estimatedValue ?? null,
  }));

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · {t(board.eyebrowCrm)}</p>
          <h1 className="u-h1">{t(nav.crm)}</h1>
        </div>
      </div>
      <FilterPanel activeCount={activeCount} variant="inline" defaultOpen={activeCount > 0}>
        <form
          method="get"
          className="card filter-card filter-card--inline"
          aria-label={t(leadsFilters.filters)}
        >
          <label className="filter-section">
            <span className="filter-section-label">{t(leadsFilters.search)}</span>
            <input
              type="search"
              name="q"
              defaultValue={search}
              placeholder={t(leadsFilters.searchPlaceholder)}
              className="field-input"
            />
          </label>
          <label className="filter-section">
            <span className="filter-section-label">{t(crmCommon.type)}</span>
            <select name="type" defaultValue={type} className="field-input">
              <option value="any">{t(ownerFilters.any)}</option>
              {LEAD_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {leadTypeLabel(locale, ty)}
                </option>
              ))}
            </select>
          </label>
          <div className="filter-actions">
            <button type="submit" className="btn-primary btn--sm">
              {t(leadsFilters.apply)}
            </button>
            {activeCount > 0 ? (
              <Link href={`${ctx.basePath}/crm`} className="filter-reset">
                {t(leadsFilters.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </FilterPanel>
      {cards.length === 0 && activeCount > 0 ? (
        <p className="empty">{t(board.noMatches)}</p>
      ) : (
        <InternalBoard leads={cards} reps={reps} basePath={ctx.basePath} apiBase={ctx.apiBase} />
      )}
    </div>
  );
}

/* ---------------- Clients (§6.4) ---------------- */

export async function ClientsBody({ ctx }: { ctx: InternalAppCtx }) {
  const locale = await getLocale();
  const t = tFor(locale);
  const clients = await listClients(ctx.brand);
  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{BRAND_EYEBROW[ctx.brand]} · {t(clientsPage.eyebrowClients)}</p>
          <h1 className="u-h1">{t(nav.clients)}</h1>
        </div>
      </div>
      {clients.length === 0 ? (
        <p className="empty">{t(clientsPage.noClientsYet)}</p>
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
                    {t(clientsPage.retainer)}
                  </span>
                ) : null}
              </div>
              <p className="ecard-title">{c.name}</p>
              <p className="ecard-sub">{c.number}</p>
              <p className="ecard-sub">
                <span>{t(clientsPage.serviceColon)}</span> {c.service ?? "—"}
              </p>
              <div className="ecard-stats">
                <div>
                  <p className="ecard-stat-label">{t(clientsPage.estimatedColon)}</p>
                  <p className="ecard-stat-value">{formatEGP(c.estimatedValue)}</p>
                </div>
                <div>
                  <p className="ecard-stat-label">{t(clientsPage.collectedColon)}</p>
                  <p className="ecard-stat-value">{formatEGP(c.collected)}</p>
                </div>
                <div>
                  <p className="ecard-stat-label">{t(clientsPage.toBeCollectedColon)}</p>
                  <p className="ecard-stat-value">
                    {formatEGP(c.toBeCollected)}
                    {c.dueDate ? ` (${t(clientsPage.due)} ${formatCairoDate(c.dueDate)})` : ""}
                  </p>
                </div>
              </div>
              <p className="ecard-footer">
                <span>{t(common.technicalOwnerColon)}</span> {c.technicalOwner ?? "—"}
              </p>
              <ClientEditForm apiBase={ctx.apiBase} client={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
