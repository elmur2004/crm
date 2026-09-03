import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { CallSheet } from "@/components/shared/CallSheet";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { callSheet } from "@/lib/i18n/dict/call";

/* ADR-074 — Mindoo's call sheet: everything about the lead on one phone-first
   screen, with a tel: link at the top. `CallSheet` re-checks requireLeadAccess
   for the specific lead and reads it under the brand it is handed, so a lead of
   another company 404s here rather than rendering under Mindoo's label. */

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: `${tFor(locale)(callSheet.meta)} — Mindoo` };
}

export default async function MindooCallSheetPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requireMindooPage();
  const { leadId } = await params;
  return (
    <CallSheet
      brand={MINDOO_SURFACE.brand}
      leadId={leadId}
      leadPath={`${MINDOO_SURFACE.basePath}/crm/lead`}
      apiBase={MINDOO_SURFACE.apiBase}
    />
  );
}
