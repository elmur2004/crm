import { requirePageRole } from "@/lib/auth/page-guards";
import { CallSheet } from "@/components/shared/CallSheet";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { callSheet } from "@/lib/i18n/dict/call";

/* Founder — the ByteForce twin of the B-Systems call sheet (same component,
   this brand's paths). CallSheet re-checks requireLeadAccess per lead. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${tFor(locale)(callSheet.meta)} — ByteForce CRM` };
}

export default async function ByteforceCallSheetPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requirePageRole("/login", "byteforce_staff");
  const { leadId } = await params;
  return (
    <CallSheet
      brand="byteforce"
      leadId={leadId}
      leadPath="/byteforce/leads/lead"
      apiBase="/api/byteforce"
    />
  );
}
