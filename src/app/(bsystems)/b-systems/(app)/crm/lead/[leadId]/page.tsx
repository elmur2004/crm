import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageRole } from "@/lib/auth/page-guards";
import { requireLeadAccess } from "@/lib/auth/guards";
import { getLeadDetail } from "@/lib/services/leads";
import { listReps } from "@/lib/services/sales-reps";
import {
  LEAD_TYPE_LABELS,
  OWNER_TYPE_LABELS,
  type LeadType,
  type OwnerType,
} from "@/lib/pipeline-engine/constants";
import { formatCairo } from "@/lib/datetime";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { BsEventPanel } from "@/components/bsystems/BsEventPanel";
import { CopyLeadButton, DeleteLeadButton, EditLeadForm } from "@/components/bsystems/leadActions";
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

  const [{ lead, history }, negotiationNotes, wonDeal] = await Promise.all([
    getLeadDetail("bsystems", leadId),
    db.negotiationNote.findMany({ where: { leadId }, orderBy: { createdAt: "desc" } }),
    db.wonDeal.findUnique({
      where: { leadId },
      include: { milestones: { orderBy: { index: "asc" } } },
    }),
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/b-systems/crm" className="text-sm text-brand-muted underline underline-offset-2">
            Back to the CRM board
          </Link>
          <h1 className="font-brand-display text-2xl font-bold text-brand-heading flex items-center gap-3 flex-wrap">
            {lead.name}
            <StageBadge stage={lead.stage} />
            {lead.readyToClose ? (
              <span className="text-xs bg-brand-accent text-brand-on-accent rounded-brand-control px-2 py-1">
                Ready to close
              </span>
            ) : null}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CopyLeadButton lead={editable} />
          {access.isAdmin ? <DeleteLeadButton leadId={lead.id} /> : null}
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
              <span className="text-brand-muted">Owner:</span>{" "}
              {OWNER_TYPE_LABELS[lead.ownerType as OwnerType] ?? lead.ownerType}
              {lead.salesRep ? ` · ${lead.salesRep.name}` : ""}
              {lead.partner ? ` · ${lead.partner.companyName}` : ""}
            </p>
            {lead.position ? (
              <p>
                <span className="text-brand-muted">Position:</span> {lead.position}
              </p>
            ) : null}
            {lead.companyName ? (
              <p>
                <span className="text-brand-muted">Company:</span> {lead.companyName}
              </p>
            ) : null}
            {lead.industry ? (
              <p>
                <span className="text-brand-muted">Industry:</span> {lead.industry}
              </p>
            ) : null}
            <p>
              <span className="text-brand-muted">Date created:</span> {formatCairo(lead.createdAt)}
            </p>
            {lead.requirements ? (
              <p className="pt-1 whitespace-pre-wrap">
                <span className="text-brand-muted">Requirements:</span> {lead.requirements}
              </p>
            ) : null}
            {lead.description ? <p className="pt-1 whitespace-pre-wrap">{lead.description}</p> : null}
          </div>

          {access.isAdmin ? <EditLeadForm lead={editable} /> : null}

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-3">Next action</h2>
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

          {wonDeal ? (
            <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm">
              <h2 className="text-brand-meta text-brand-muted mb-2">Won deal</h2>
              <p>
                {wonDeal.milestones.filter((m) => m.completed).length}/{wonDeal.milestones.length}{" "}
                milestones completed
                {access.isAdmin ? (
                  <>
                    {" — "}
                    <Link
                      href={`/b-systems/won-leads/${wonDeal.id}`}
                      className="text-brand-link underline underline-offset-2"
                    >
                      open in Won Leads
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ) : null}
        </section>

        <section className="space-y-4">
          {negotiationNotes.length > 0 ? (
            <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
              <h2 className="text-brand-meta text-brand-muted mb-2">Negotiation notes</h2>
              <ul className="space-y-2 text-sm">
                {negotiationNotes.map((n) => (
                  <li key={n.id}>
                    <p className="whitespace-pre-wrap">{n.note}</p>
                    <p className="text-xs text-brand-muted">{formatCairo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div>
            <h2 className="text-brand-meta text-brand-muted mb-2">Stage records</h2>
            <GroupHistory
              followUps={lead.followUps}
              meetings={lead.meetings}
              proposals={lead.proposals}
              lostInfo={lead.lostInfo}
              won={lead.wonInfo}
            />
          </div>
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-2">History</h2>
            <HistoryPanel entries={history} />
          </div>
        </section>
      </div>
    </div>
  );
}
