import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { getDealDetail } from "@/lib/services/portal-deals";
import { StageBadge } from "@/components/shared/StageBadge";
import { GroupHistory } from "@/components/internal/GroupHistory";
import { HistoryPanel } from "@/components/internal/HistoryPanel";
import { PortalDealEventPanel } from "@/components/portal/PortalDealEventPanel";
import { ApiError } from "@/lib/api-error";

export const metadata = { title: "Deal — Partnership Portal" };

export default async function DealDetail({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await requirePageRole("/portal/login", "portal_rep", "portal_admin");
  const isAdmin = user.roles.includes("portal_admin");

  let data;
  try {
    data = await getDealDetail(dealId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const { deal, history } = data;

  /* Rep isolation (§3): a rep can only open their own deals — server-side. */
  if (!isAdmin && deal.rep.id !== user.portalRepId) {
    redirect("/portal/crm");
  }

  const latestMeeting = deal.meetings.at(-1);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/portal/crm" className="text-sm text-brand-muted underline underline-offset-2">
          Back to the board
        </Link>
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading flex items-center gap-3 flex-wrap">
          {deal.name}
          <StageBadge stage={deal.stage} />
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <section className="space-y-4">
          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4 text-sm space-y-1">
            <p>
              <span className="text-brand-muted">Position:</span> {deal.position}
            </p>
            <p>
              <span className="text-brand-muted">Number:</span> {deal.number}
            </p>
            <p>
              <span className="text-brand-muted">Email:</span> {deal.email ?? "—"}
            </p>
            <p>
              <span className="text-brand-muted">Company:</span> {deal.companyName}
            </p>
            <p>
              <span className="text-brand-muted">Industry:</span> {deal.industry}
            </p>
            {deal.requirements ? (
              <p className="pt-1 whitespace-pre-wrap">{deal.requirements}</p>
            ) : null}
          </div>

          <div className="bg-brand-surface-card border border-brand-border rounded-brand-card p-4">
            <h2 className="text-brand-meta text-brand-muted mb-3">Next action</h2>
            <PortalDealEventPanel
              dealId={deal.id}
              stage={deal.stage}
              isAdmin={isAdmin}
              ownerPortalRepId={user.portalRepId ?? undefined}
              hasUnsentProposal={deal.proposals.some((p) => !p.sent)}
              pendingMeeting={Boolean(
                latestMeeting && latestMeeting.outcome === null && latestMeeting.arranged,
              )}
            />
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-brand-meta text-brand-muted mb-2">Stage records</h2>
            <GroupHistory
              followUps={deal.followUps}
              meetings={deal.meetings}
              proposals={deal.proposals}
              lostInfo={deal.lostInfo}
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
