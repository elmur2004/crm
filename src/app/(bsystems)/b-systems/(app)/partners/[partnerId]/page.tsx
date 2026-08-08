import { PartnerDetailBody } from "@/components/partners/pages";

export const metadata = { title: "Partner — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  return <PartnerDetailBody partnerId={partnerId} />;
}
