import { PartnerDetailBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { pMeta } from "@/lib/i18n/dict/partners";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(pMeta.partnerTitle) };
}

export default async function Page({ params }: { params: Promise<{ partnerId: string }> }) {
  await requireBsAdminPage();
  const { partnerId } = await params;
  return <PartnerDetailBody partnerId={partnerId} />;
}
