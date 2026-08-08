import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { listDeals } from "@/lib/services/portal-deals";
import { DealBoard, NewDealForm, type BoardDeal } from "@/components/portal/DealBoard";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "CRM — Partnership Portal" };

/* §8.2 — the rep's own six-column board (rep isolation server-side; admins see
   the combined boards in their own section, Phase 4). */

export default async function PortalCrm() {
  const user = await requirePageRole("/portal/login", "portal_rep", "portal_admin");
  if (!user.portalRepId) redirect("/portal"); // admins get their own CRM (§8.5, Phase 4)
  const deals = await listDeals(user.portalRepId);

  const boardDeals: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    companyName: d.companyName,
    industry: d.industry,
    stage: d.stage,
    keyDatum:
      d.stage === "following_up" && d.followUps[0]
        ? `Next: ${formatCairo(d.followUps[0].dueAt)}`
        : d.stage === "meeting_setting" && d.meetings[0]?.datetime
          ? `Meeting: ${formatCairo(d.meetings[0].datetime)}`
          : d.stage === "proposal_sending" && d.proposals[0]?.estimatedValue != null
            ? `Est: ${formatEGP(d.proposals[0].estimatedValue)}`
            : d.stage === "lost"
              ? (d.lostInfo[0]?.reason ?? "")
              : "",
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="font-brand-display text-2xl font-bold text-brand-heading">CRM</h1>
        <NewDealForm />
      </div>
      <DealBoard
        deals={boardDeals}
        isAdmin={false}
        ownerPortalRepId={user.portalRepId ?? undefined}
        detailBase="/portal/crm"
      />
    </div>
  );
}
