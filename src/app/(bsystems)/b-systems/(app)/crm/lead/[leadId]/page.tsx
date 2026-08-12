import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/page-guards";
import { requireLeadAccess } from "@/lib/auth/guards";
import { getLeadDetail } from "@/lib/services/leads";
import { listReps } from "@/lib/services/sales-reps";
import { formatCairo } from "@/lib/datetime";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { leadTypeLabel, ownerTypeLabel } from "@/lib/i18n/dict/labels";
import { common, crmPage, leadDetail as m } from "@/lib/i18n/dict/crm";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { BsEventPanel } from "@/components/bsystems/BsEventPanel";
import { CopyLeadButton, DeleteLeadButton, EditLeadForm } from "@/components/bsystems/leadActions";
import { LeadChat } from "@/components/shared/LeadChat";
import { listLeadComments, mentionableUsersFor } from "@/lib/services/comments";
import type { BsFormRole } from "@/components/bsystems/roleForms";

export const metadata = { title: "Lead — B-Systems CRM" };

/* V2 — the ONE lead detail page for every role. Access is re-checked server-side
   (admin any / sales internal / agent+partner own only); admin additionally gets
   edit / copy / delete. */

export default async function BsLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
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
      ? (await listReps("bsystems")).map((r) => ({ id: r.id, name: r.name }))
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
          <CopyLeadButton lead={editable} />
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
            <p className="fields-value">{formatCairo(lead.createdAt)}</p>
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
          {/* founder: the lead's OWNER edits too — the API enforces access
              (admin any / sales internal / agent+partner own) */}
          <EditLeadForm lead={editable} />

          <div className="card card--flush0">
            <div className="card-head">
              <h2 className="u-h3">{t(common.nextAction)}</h2>
            </div>
            <div className="card-pad">
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
                      <p className="record-time">{formatCairo(n.createdAt)}</p>
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
