import { notFound } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { getDealDetail } from "@/lib/services/portal-deals";
import { DealDetailView } from "@/components/portal/DealDetailView";
import { ApiError } from "@/lib/api-error";

export const metadata = { title: "Deal — Portal Admin" };

export default async function AdminDealDetail({
  params,
}: {
  params: Promise<{ dealId: string }>;
}) {
  const { dealId } = await params;
  await requirePageRole("/portal/login", "portal_admin");

  let data;
  try {
    data = await getDealDetail(dealId);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <DealDetailView
      deal={data.deal}
      history={data.history}
      isAdmin
      backHref="/portal/admin/crm"
      repLabel={`${data.deal.rep.firstName} ${data.deal.rep.lastName}`}
    />
  );
}
