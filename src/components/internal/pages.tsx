import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import type { CrmSurface } from "@/lib/crm/surface";
import { INTERNAL_STAGES, LEAD_TYPES } from "@/lib/pipeline-engine/constants";
import { internalCrmConfig } from "@/lib/pipeline-engine/configs/internal-crm";
import { orderMeetingColumn } from "@/lib/board-order";
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
import { waHref } from "@/lib/phone-dial";
import { waSentLabel, whatsappMarkOf } from "@/components/shared/whatsappMark";
import { WhatsappChip } from "@/components/shared/WhatsappChip";
import { StatCard } from "@/components/shared/StatCard";
import { AnimatedValue } from "@/components/shared/AnimatedValue";
import { StageBadge } from "@/components/shared/StageBadge";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
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

/* Brand-parameterized server bodies for the internal CRMs (§6). ADR-067 mounts
   them under the MERGED shell at /b-systems with ?company=byteforce; the API
   base stays the ByteForce namespace, which is what keeps the server-side brand
   derivation exactly where it was. All data access is brand-scoped through the
   services. */

/* ADR-074 — these bodies take the SAME surface object the B-Systems bodies do
   (lib/crm/surface.ts). It was a second, near-identical interface declared
   here; two shapes describing one idea is how the two halves of the app drift
   apart, and the alias keeps every existing `InternalAppCtx` annotation in the
   file reading exactly as it did. */
export type InternalAppCtx = CrmSurface;

/* Mono eyebrow context line per brand (design spec §2.2 — additive, not a reword). */
const BRAND_EYEBROW: Record<Brand, string> = {
  byteforce: "BYTEFORCE",
  bsystems: "B-SYSTEMS",
  mindoo: "MINDOO", // ADR-073
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
          <Link key={rep.id} href={`${ctx.basePath}/leads/rep/${rep.id}${ctx.query}`} className="ecard">
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
          <Link href={`${ctx.basePath}/leads/rep/unassigned${ctx.query}`} className="ecard ecard--accent">
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
          <Link href={`${ctx.basePath}/leads${ctx.query}`} className="text-sm text-brand-muted underline underline-offset-2">
            {t(leadsPage.backToAllReps)}
          </Link>
          <h1 className="u-h1">
            {rep ? rep.name : t(leadsPage.unassignedPartnerLeads)}
          </h1>
        </div>
        <div className="page-actions">
          <nav className="flex gap-1 flex-wrap" aria-label={t(archiveMsgs.archived)}>
            <Link href={`${basePath}${ctx.query}`} className="nav-item" aria-current={archived ? undefined : "page"}>
              {t(archiveMsgs.active)}
            </Link>
            <Link
              href={`${basePath}${ctx.query}${ctx.query ? "&" : "?"}view=archived`}
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
                      <Link href={`${ctx.basePath}/leads/lead/${lead.id}${ctx.query}`} className="td-title">
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
          <Link href={`${ctx.basePath}/crm${ctx.query}`} className="text-sm text-brand-muted underline underline-offset-2">
            {t(leadDetail.backToBoard)}
          </Link>
        </div>
        <div className="page-actions">
          {/* founder: the dial entry point — opens the phone-first call sheet.
              PRIMARY, not accent: calling the lead is the page's one true
              action, and accent is already the Ready-to-close cue here. */}
          <Link href={`${ctx.basePath}/leads/lead/${lead.id}/call${ctx.query}`} className="btn-primary">
            {t(callSheet.navLabel)}
          </Link>
          {/* founder: "message on WhatsApp" beside every Call — outlined, since
              dialing stays the page's one primary action.
              ADR-069 — green once anyone has messaged this lead, the same chip
              and the same sentence as the board card it came from. */}
          {waHref(lead.number) ? (
            <WhatsappChip
              href={waHref(lead.number)!}
              markUrl={`${ctx.apiBase}/leads/${lead.id}/whatsapp`}
              sentLabel={waSentLabel(locale, whatsappMarkOf(lead))}
              justSentLabel={t(callSheet.whatsappSentJustNow)}
              restLabel={t(callSheet.whatsapp)}
              className="btn-ghost"
            >
              {t(callSheet.whatsapp)}
            </WhatsappChip>
          ) : null}
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
            <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
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
            <p className="fields-value">{formatCairo(lead.createdAt, locale)}</p>
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
              postponeInfos={lead.postponeInfos}
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
  showMindoo = false,
}: {
  ctx: InternalAppCtx;
  params?: { q?: string; type?: string };
  /* ADR-076 — whether to draw MINDOO'S leads beside this company's, as purple
     read-only cards. Founder: "the crm of mindoo should appear in byteforce crm
     as purple cards and not in bsystems crm."

     Decided by the PAGE, from the live roles, and defaulted OFF: the ByteForce
     board is rendered for every `byteforce_staff` account, and only the
     platform administrator should see another company's pipeline. A default of
     `true` would have made that an opt-out. */
  showMindoo?: boolean;
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
        return formatCairo(lead.createdAt, locale); // intake cards show when they arrived
      case "following_up":
        /* ADR-061 + ADR-063: a follow-up is a DAY unless someone chose a time —
           the clock rides `dueTimeSet`, never the instant. */
        return lead.followUps[0]
          ? `${t(board.nextPrefix)} ${formatCairo(lead.followUps[0].dueAt, locale, lead.followUps[0].dueTimeSet)}`
          : t(board.noFollowUpSet);
      case "meeting_setting":
        return lead.meetings[0]?.datetime
          ? `${t(board.meetingPrefix)} ${formatCairo(lead.meetings[0].datetime, locale)}`
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
    noAnswerCount: lead.noAnswerCount, // ADR-064 — the card says how many tries

    latestProposalValue: lead.proposals[0]?.estimatedValue ?? null,
    waHref: waHref(lead.number),
    /* ADR-069 — the chip's green state and the sentence that goes with it,
       both resolved HERE: the mark is the record's, and the date goes through
       the one shared formatter rather than a clock on the client */
    waSentLabel: waSentLabel(locale, whatsappMarkOf(lead)),
    waMarkUrl: `${ctx.apiBase}/leads/${lead.id}/whatsapp`,
    /* the Today chip's datum (ADR-061) — the same latest follow-up the key
       datum shows, only on Following Up cards */
    followUpDueAt:
      lead.stage === "following_up" && lead.followUps[0]
        ? lead.followUps[0].dueAt.toISOString()
        : null,
    /* ADR-064 — the instant the Meeting Setting card SHOWS (its keyDatum
       above), which is also the instant its column is ordered and filtered by */
    meetingAt:
      lead.stage === internalCrmConfig.meetingStage && lead.meetings[0]?.datetime
        ? lead.meetings[0].datetime.toISOString()
        : null,
  }));
  /* ADR-076 — MINDOO'S LEADS, as purple read-only cards.

     THE STAGE PROBLEM, and the founder's answer to it. Mindoo runs the
     B-Systems pipeline, which has a NEGOTIATION stage this board does not: a
     Mindoo lead sitting there has no column to land in, and simply not
     rendering it would hide the deals furthest along — usually the ones most
     worth seeing. Asked, he chose to show them in Sending Proposals. So the
     card is placed there and CARRIES ITS REAL STAGE on its face, because a
     column that silently relabels a deal is worse than one that admits it. */
  const foreign: InternalBoardLead[] = showMindoo
    ? (
        await db.lead.findMany({
          where: {
            brand: "mindoo",
            archived: false,
            ...leadSearchWhere(search),
            ...leadTypeWhere(type),
          },
          include: {
            followUps: { orderBy: { createdAt: "desc" }, take: 1 },
            meetings: { orderBy: { createdAt: "desc" }, take: 1 },
            proposals: { orderBy: { createdAt: "desc" }, take: 1 },
            lostInfo: { orderBy: { createdAt: "desc" }, take: 1 },
          },
          orderBy: { updatedAt: "desc" },
        })
      ).map((lead) => {
        /* the column this board can actually draw it in */
        const column = (BOARD_STAGES as readonly string[]).includes(lead.stage)
          ? lead.stage
          : /* the founder's choice for a stage this board has no column for.
               `proposalStage` is optional on a PipelineConfig, so the literal
               is the floor — and it is the same stage internal-crm names. */
            (internalCrmConfig.proposalStage ?? "sending_proposal");
        return {
          id: lead.id,
          name: lead.name,
          subtitle: leadTypeLabel(locale, lead.type),
          partnerBadge: null,
          stage: column,
          foreignCompany: {
            label: "Mindoo",
            href: `${ctx.basePath}/crm/company-lead/${lead.id}${ctx.query}`,
            /* named ONLY when the column is not the lead's own stage — on a
               card that is where it belongs, repeating the column would be
               noise */
            stageLabel: column === lead.stage ? null : stageLabel(locale, lead.stage),
          },
          keyDatum: "",
          noAnswer: lead.noAnswer,
          noAnswerCount: lead.noAnswerCount,
          latestProposalValue: null,
          waHref: null,
          waSentLabel: null,
          waMarkUrl: "",
          followUpDueAt: null,
          meetingAt: null,
        } satisfies InternalBoardLead;
      })
    : [];

  /* founder (ADR-064): the Meeting Setting column runs soonest-meeting-first,
     always — server-side, where the list is built, so the client never has to
     re-order. Every other column keeps its `updatedAt desc`. */
  const orderedCards = orderMeetingColumn([...cards, ...foreign], internalCrmConfig.meetingStage);

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
          {/* ADR-067 — a plain method="get" submit REPLACES the whole query
              string with this form's own fields. Without this, applying a
              filter on the ByteForce board would drop ?company= and bounce the
              founder back to B-Systems, which reads as data loss rather than a
              nav bug. */}
          {ctx.companyParam ? (
            <input type="hidden" name="company" value={ctx.companyParam} />
          ) : null}
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
              <Link href={`${ctx.basePath}/crm${ctx.query}`} className="filter-reset">
                {t(leadsFilters.clear)}
              </Link>
            ) : null}
          </div>
        </form>
      </FilterPanel>
      {orderedCards.length === 0 && activeCount > 0 ? (
        <p className="empty">{t(board.noMatches)}</p>
      ) : (
        <InternalBoard
          leads={orderedCards}
          reps={reps}
          basePath={ctx.basePath}
          query={ctx.query}
          apiBase={ctx.apiBase}
        />
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
                    {c.dueDate ? ` (${t(clientsPage.due)} ${formatCairoDate(c.dueDate, locale)})` : ""}
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
