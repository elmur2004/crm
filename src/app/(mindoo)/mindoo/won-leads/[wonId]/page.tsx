import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { BsWonDealBody } from "@/components/bsystems/pages/BsWonDealBody";
import { tFor } from "@/lib/i18n/core";
import { getLocale } from "@/lib/i18n/server";
import { wonLeads } from "@/lib/i18n/dict/admin";

export async function generateMetadata() {
  const locale = await getLocale();
  return { title: tFor(locale)(wonLeads.metaDetail) };
}

/* ADR-074 — Mindoo's won-deal detail: client details, contract date, the
   sequential milestone checklist and the document uploads.

   The body refuses any deal whose lead does not carry `ctx.brand` — the wall
   that stops one company opening another company's deal by guessing an id.
   ADR-073 found that hole for milestones (an id was proof enough while there
   was one company and proof of nothing once there were three); this is the same
   check on the page that reaches them. */

export default async function MindooWonDealPage({
  params,
}: {
  params: Promise<{ wonId: string }>;
}) {
  await requireMindooPage();
  const { wonId } = await params;
  return <BsWonDealBody ctx={MINDOO_SURFACE} wonId={wonId} />;
}
