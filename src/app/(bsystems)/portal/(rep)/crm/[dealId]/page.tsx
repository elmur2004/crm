import { notFound, redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { getDealDetail } from "@/lib/services/portal-deals";
import { DealDetailView } from "@/components/portal/DealDetailView";
import { ApiError } from "@/lib/api-error";

export const metadata = { title: "Deal — Partnership Portal" };

export default async function DealDetail({ params }: { params: Promise<{ dealId: string }> }) {
  const { dealId } = await params;
  const user = await requirePageRole("/login", "portal_rep", "portal_admin");
  const isAdmin = user.roles.includes("portal_admin");

  let data;
  try {
    data = await getDealDetail(dealId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  /* Rep isolation (§3): a rep can only open their own deals — server-side. */
  if (!isAdmin && data.deal.rep.id !== user.portalRepId) {
    redirect("/portal/crm");
  }

  return (
    <DealDetailView
      deal={data.deal}
      history={data.history}
      isAdmin={isAdmin}
      backHref="/portal/crm"
    />
  );
}
