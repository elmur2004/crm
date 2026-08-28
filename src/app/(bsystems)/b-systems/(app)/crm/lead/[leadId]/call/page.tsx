import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { CallSheet } from "@/components/shared/CallSheet";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { callSheet } from "@/lib/i18n/dict/call";

/* Founder — the page the Dial button opens: everything about the lead on one
   phone-first screen, with a tel: link at the top. Role wall is the same as the
   lead detail; CallSheet re-checks requireLeadAccess for the specific lead. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${tFor(locale)(callSheet.meta)} — B-Systems CRM` };
}

export default async function BsCallSheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  /* ADR-067 — B-Systems only; ByteForce's call sheet is its own route. */
  await requireCompanySection("bsystems", (await searchParams).company, BS_PIPELINE_ROLES);
  const { leadId } = await params;
  return (
    <CallSheet
      brand="bsystems"
      leadId={leadId}
      leadPath="/b-systems/crm/lead"
      apiBase="/api/b-systems"
    />
  );
}
