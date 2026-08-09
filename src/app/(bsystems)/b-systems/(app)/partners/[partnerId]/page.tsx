import { PartnerDetailBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";

export const metadata = { title: "Partner — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  await requireBsAdminPage();
  const { partnerId } = await params;
  return <PartnerDetailBody partnerId={partnerId} />;
}
