import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { requireLeadAccess } from "@/lib/auth/guards";
import { getLeadDetail } from "@/lib/services/leads";
import { listBsOwnerReps } from "@/lib/services/sales-reps";
import { formatCairo } from "@/lib/datetime";
import { waHref } from "@/lib/phone-dial";
import { tFor, type Msg } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage, leadDetail as m } from "@/lib/i18n/dict/crm";
import { callSheet } from "@/lib/i18n/dict/call";
import { StageBadge } from "@/components/shared/StageBadge";
import { NoAnswerBadge } from "@/components/shared/NoAnswerBadge";
import { ArchiveButton } from "@/components/shared/ArchiveButton";
import { archiveMsgs } from "@/lib/i18n/dict/crm";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { BsEventPanel } from "@/components/bsystems/BsEventPanel";
import {
  AssignLeadButton,
  CopyLeadButton,
  DeleteLeadButton,
  EditLeadForm,
  type AssignableOwner,
} from "@/components/bsystems/leadActions";
import { listAssignableOwners } from "@/lib/services/users";
import { roles as roleMsgs } from "@/lib/i18n/dict/crm";
import { LeadChat } from "@/components/shared/LeadChat";
import { listLeadComments, mentionableUsersFor } from "@/lib/services/comments";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "Lead — B-Systems CRM" };

/* V2 — the ONE lead detail page for every role. Access is re-checked server-side
   (admin any / sales internal / agent+partner own only); admin additionally gets
   edit / copy / delete. */

export default async function BsLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — the B-Systems lead detail. ByteForce's is a different screen at
     /b-systems/leads/lead/[leadId]; this address is B-Systems only. */
  await requireCompanySection("bsystems", (await searchParams).company, BS_PIPELINE_ROLES);
  const locale = await getLocale();
  const t = tFor(locale);
  const { leadId } = await params;

  let access;
  try {
    access = await requireLeadAccess(leadId);
  } catch {
    notFound();
  }
  const role: BsFormRole =
    access.role === "bsystems_admin"
      ? "admin"
      : access.role === "bsystems_sales"
        ? "sales"
        : access.role === "bsystems_agent"
          ? "agent"
          : "partner";

  const [{ lead, history }, negotiationNotes, wonDeal, comments, mentionables] = await Promise.all([
    getLeadDetail("bsystems", leadId),
    db.negotiationNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } }),
    db.wonDeal.findUnique({
      where: { leadId },
      include: { milestones: { orderBy: { index: "asc" } } },
    }),
    listLeadComments(leadId),
    mentionableUsersFor(leadId),
  ]);
  const reps =
    role === "admin" || role === "sales"
      ? (await listBsOwnerReps()).map((r) => ({ id: r.id, name: r.name }))
      : [];
  /* founder: only the admin hands a lead to someone — labels resolved here so
     the client component stays string-free (V5 bilingual rule) */
  const roleLabels: Record<string, Msg> = roleMsgs;
  const assignableOwners: AssignableOwner[] = access.isAdmin
    ? (await listAssignableOwners()).map((o) => ({
        id: o.id,
        name: o.name,
        company: o.company,
        roleLabel: t(
          roleLabels[o.roles.find((r) => roleLabels[r]) ?? ""] ?? roleMsgs.bsystems_agent,
        ),
      }))
    : [];
  const latestMeeting = lead.meetings.at(-1);
  const editable = {
    id: lead.id,
    name: lead.name,
    number: lead.number,
    email: lead.email,
    type: lead.type,
    description: lead.description,
    position: lead.position,
    companyName: lead.companyName,
    industry: lead.industry,
    requirements: lead.requirements,
  };

  return (
    <div className="space-y-6">
      <div className="page-head">
        <div>
          <p className="u-eyebrow">{t(crmPage.eyebrow)}</p>
          <Link href="/b-systems/crm" className="text-sm text-brand-muted underline underline-offset-2">
            {t(m.backToBoard)}
          </Link>
        </div>
        <div className="page-actions">
          {/* founder: the dial entry point — opens the phone-first call sheet.
              PRIMARY, not accent: calling the lead is the page's one true
              action, and accent is already the Ready-to-close cue here. */}
          <Link href={`/b-systems/crm/lead/${lead.id}/call`} className="btn-primary">
            {t(callSheet.navLabel)}
          </Link>
          {/* founder: "message on WhatsApp" beside every Call — outlined, since
              dialing stays the page's one primary action */}
          {waHref(lead.number) ? (
            <a href={waHref(lead.number)!} target="_blank" rel="noopener" className="btn-ghost">
              {t(callSheet.whatsapp)}
            </a>
          ) : null}
          <CopyLeadButton lead={editable} />
          {access.isAdmin && !lead.archived ? (
            <AssignLeadButton
              leadId={lead.id}
              owners={assignableOwners}
              currentOwnerUserId={lead.ownerUserId}
            />
          ) : null}
          <ArchiveButton
            postUrl={`/api/b-systems/leads/${lead.id}/archive`}
            archived={lead.archived}
          />
          {access.isAdmin ? <DeleteLeadButton leadId={lead.id} /> : null}
        </div>
      </div>

      <div className="card card--flush0">
        <div className="identity-head">
          <h1 className="identity-name flex items-center gap-3 flex-wrap">
            {lead.name}
            <StageBadge stage={lead.stage} header />
            {lead.readyToClose ? (
              <span className="badge badge--accent">{t(common.readyToClose)}</span>
            ) : null}
            <NoAnswerBadge locale={locale} count={lead.noAnswerCount} />
            {lead.archived ? (
              <span className="badge badge--archived">{t(archiveMsgs.archived)}</span>
            ) : null}
          </h1>
        </div>
        <div className="fields-grid">
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldNumber)}</p>
            <p className="fields-value">{lead.number}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldEmail)}</p>
            <p className="fields-value">{lead.email ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldType)}</p>
            <p className="fields-value">{leadTypeLabel(locale, lead.type)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldOwner)}</p>
            <p className="fields-value">
              {ownerTypeLabel(locale, lead.ownerType)}
              {/* founder: the assigned person by name; the referring partner
                  company stays visible beside it — a different fact */}
              {lead.owner ? ` · ${lead.owner.name}` : ""}
              {lead.salesRep ? ` · ${lead.salesRep.name}` : ""}
              {lead.partner ? ` · ${lead.partner.companyName}` : ""}
            </p>
          </div>
          {/* founder: EVERY creation field shows here, empty or not */}
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldPosition)}</p>
            <p className="fields-value">{lead.position ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldCompany)}</p>
            <p className="fields-value">{lead.companyName ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldIndustry)}</p>
            <p className="fields-value">{lead.industry ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldDateCreated)}</p>
            <p className="fields-value">{formatCairo(lead.createdAt, locale)}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldRequirements)}</p>
            <p className="fields-value whitespace-pre-wrap">{lead.requirements ?? "—"}</p>
          </div>
          <div className="fields-cell">
            <p className="fields-label">{t(m.fieldNotes)}</p>
            <p className="fields-value whitespace-pre-wrap">{lead.description ?? "—"}</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          {/* ADR-043 hardening: an archived lead is read-only — no edits, no
              events (the API rejects them too); the chat stays open. */}
          {!lead.archived ? (
            /* founder: the lead's OWNER edits too — the API enforces access
               (admin any / sales internal / agent+partner own) */
            <EditLeadForm lead={editable} />
          ) : null}

          <div className="card card--flush0">
            <div className="card-head">
              <h2 className="u-h3">{t(common.nextAction)}</h2>
            </div>
            <div className="card-pad">
              {lead.archived ? (
                <p className="u-muted">{t(archiveMsgs.archivedNote)}</p>
              ) : (
                <BsEventPanel
                  leadId={lead.id}
                  stage={lead.stage}
                  role={role}
                  reps={reps}
                  hasUnsentProposal={lead.proposals.some((p) => !p.sent)}
                  pendingMeeting={Boolean(
                    latestMeeting && latestMeeting.outcome === null && latestMeeting.arranged,
                  )}
                  readyToClose={lead.readyToClose}
                />
              )}
            </div>
          </div>

          {wonDeal ? (
            <div className="card card--flush0 text-sm">
              <div className="card-head">
                <h2 className="u-h3">{t(m.wonDeal)}</h2>
              </div>
              <div className="card-pad">
                <p>
                  {wonDeal.milestones.filter((ms) => ms.completed).length}/{wonDeal.milestones.length}{" "}
                  {t(m.milestonesCompleted)}
                  {access.isAdmin ? (
                    <>
                      {" — "}
                      <Link
                        href={`/b-systems/won-leads/${wonDeal.id}`}
                        className="text-brand-link underline underline-offset-2"
                      >
                        {t(m.openInWonLeads)}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {/* founder: the mini chat — questions, follow-ups, @mentions */}
          <LeadChat
            postUrl={`/api/b-systems/leads/${lead.id}/comments`}
            comments={comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString() }))}
            mentionables={mentionables}
            currentUserId={access.user.id}
          />
          {negotiationNotes.length > 0 ? (
            <div className="card card--flush0">
              <div className="card-head">
                <h2 className="u-h3">{t(m.negotiationNotes)}</h2>
              </div>
              <div className="card-pad">
                <ul className="space-y-2 text-sm">
                  {negotiationNotes.map((n) => (
                    <li key={n.id}>
                      <p className="whitespace-pre-wrap">{n.note}</p>
                      <p className="record-time">{formatCairo(n.createdAt, locale)}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
          <div>
            <h2 className="u-h3 mb-2">{t(m.stageRecords)}</h2>
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
              <h2 className="u-h3">{t(m.history)}</h2>
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
