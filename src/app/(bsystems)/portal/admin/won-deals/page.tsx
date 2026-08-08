import { requirePageRole } from "@/lib/auth/page-guards";
import { listWonDealsForAdmin } from "@/lib/services/portal-admin";
import { WonDealManager, type AdminWonDeal } from "@/components/portal/WonDealManager";

export const metadata = { title: "Won Deals — Portal Admin" };

/* §8.5.3 — every won deal regardless of rep. */

export default async function AdminWonDeals() {
  await requirePageRole("/portal/login", "portal_admin");
  const wonDeals = await listWonDealsForAdmin();

  const items: AdminWonDeal[] = wonDeals.map((w) => ({
    id: w.id,
    repName: `${w.deal.rep.firstName} ${w.deal.rep.lastName}`,
    dealName: w.deal.name,
    companyName: w.deal.companyName,
    estimatedValue: w.estimatedValue,
    totalCommission: w.totalCommission,
    milestones: w.milestones.map((m) => ({
      id: m.id,
      index: m.index,
      value: m.value,
      completed: m.completed,
    })),
  }));

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Won Deals</h1>
      {items.length === 0 ? (
        <p className="text-sm text-brand-muted">
          No won deals yet — move a deal to Won on the CRM board first.
        </p>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((w) => (
            <WonDealManager key={w.id} wonDeal={w} />
          ))}
        </div>
      )}
    </div>
  );
}
