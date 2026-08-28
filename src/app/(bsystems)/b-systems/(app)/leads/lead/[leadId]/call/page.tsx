import { requireCompanySection } from "@/lib/auth/page-guards";
import { CallSheet } from "@/components/shared/CallSheet";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { callSheet } from "@/lib/i18n/dict/call";

/* ADR-067 — ByteForce's call sheet, in the merged shell. Same shared component
   as the B-Systems one, this company's paths and API namespace. CallSheet
   re-checks requireLeadAccess per lead. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${tFor(locale)(callSheet.meta)} — B-Systems CRM` };
}

export default async function MergedCallSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  await requireCompanySection("byteforce", (await searchParams).company);
  const { leadId } = await params;
  return (
    <CallSheet
      brand="byteforce"
      leadId={leadId}
      leadPath="/b-systems/leads/lead"
      query="?company=byteforce"
      apiBase="/api/byteforce"
    />
  );
}
