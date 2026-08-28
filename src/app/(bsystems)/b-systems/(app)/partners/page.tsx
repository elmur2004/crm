import { PartnersDirectoryBody } from "@/components/partners/pages";
import { requireBsAdminCompanyPage } from "@/lib/auth/page-guards";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { pMeta } from "@/lib/i18n/dict/partners";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(pMeta.directoryTitle) };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — B-Systems only, admin only, in that order. */
  await requireBsAdminCompanyPage((await searchParams).company);
  return <PartnersDirectoryBody />;
}
