import Link from "next/link";
import { requirePageRole } from "@/lib/auth/page-guards";
import { listAllDeals, listPortalReps } from "@/lib/services/portal-admin";
import { DealBoard, type BoardDeal } from "@/components/portal/DealBoard";
import { formatCairo } from "@/lib/datetime";
import { formatEGP } from "@/lib/money";

export const metadata = { title: "CRM — Portal Admin" };

/* §8.5.2 — toggle: all reps combined (cards labeled per rep) or per-rep. The
   admin is the only role that can move a deal into Won (drag or action) — P-6. */

export default async function AdminCrm({
  searchParams,
}: {
  searchParams: Promise<{ rep?: string }>;
}) {
  await requirePageRole("/portal/login", "portal_admin");
  const { rep: repFilter } = await searchParams;
  const [allDeals, reps] = await Promise.all([listAllDeals(), listPortalReps()]);
  const deals = repFilter ? allDeals.filter((d) => d.rep.id === repFilter) : allDeals;

  const boardDeals: BoardDeal[] = deals.map((d) => ({
    id: d.id,
    name: d.name,
    companyName: d.companyName,
    industry: d.industry,
    stage: d.stage,
    repName: `${d.rep.firstName} ${d.rep.lastName}`,
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
        <nav className="flex gap-2 flex-wrap items-center text-sm" aria-label="Rep filter">
          <Link
            href="/portal/admin/crm"
            className={`px-3 py-1.5 rounded-brand-control border ${
              !repFilter
                ? "bg-brand-primary text-brand-on-primary border-brand-primary"
                : "border-brand-border text-brand-link"
            }`}
          >
            All reps combined
          </Link>
          {reps.map((r) => (
            <Link
              key={r.id}
              href={`/portal/admin/crm?rep=${r.id}`}
              className={`px-3 py-1.5 rounded-brand-control border ${
                repFilter === r.id
                  ? "bg-brand-primary text-brand-on-primary border-brand-primary"
                  : "border-brand-border text-brand-link"
              }`}
            >
              {r.firstName} {r.lastName}
            </Link>
          ))}
        </nav>
      </div>
      <DealBoard deals={boardDeals} isAdmin detailBase="/portal/admin/crm" />
    </div>
  );
}
