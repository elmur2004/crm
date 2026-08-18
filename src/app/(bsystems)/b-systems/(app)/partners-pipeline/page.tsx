import { PartnersPipelineBody } from "@/components/partners/pages";
import { requireBsAdminPage } from "@/lib/auth/page-guards";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { pMeta } from "@/lib/i18n/dict/partners";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(pMeta.pipelineTitle) };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; q?: string }>;
}) {
  await requireBsAdminPage();
  /* founder: "add a filter for agents and partners" — query-param driven, the
     narrowing itself happens server-side in the body's query */
  const params = await searchParams;
  const kind = params.kind === "partner" || params.kind === "agent" ? params.kind : "any";
  const search = (params.q ?? "").trim();
  return <PartnersPipelineBody kind={kind} search={search} />;
}
