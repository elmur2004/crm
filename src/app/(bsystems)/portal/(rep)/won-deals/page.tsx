import { requirePageRole } from "@/lib/auth/page-guards";
import { repWonDeals } from "@/lib/services/won-deals";
import { WonDealsList } from "@/components/portal/WonDealsList";
import { redirect } from "next/navigation";

export const metadata = { title: "Won Deals — Partnership Portal" };

/* §8.3 — read-only won deals; locked milestone values are redacted server-side
   and the list polls for admin unlocks (ADR-009). */

export default async function WonDeals() {
  const user = await requirePageRole("/login", "portal_rep", "portal_admin");
  if (!user.portalRepId) redirect("/portal/crm");
  const wonDeals = await repWonDeals(user.portalRepId);

  return (
    <div className="space-y-6">
      <h1 className="font-brand-display text-2xl font-bold text-brand-heading">Won Deals</h1>
      <WonDealsList initial={wonDeals} />
    </div>
  );
}
