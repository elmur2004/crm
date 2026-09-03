import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { BsLeadDetailBody } from "@/components/bsystems/pages/BsLeadDetailBody";

export const metadata = { title: "Lead — Mindoo" };

/* ADR-074 — Mindoo's lead detail, at Mindoo's own address.

   TWO walls, and both are load-bearing. `requireMindooPage` says this account
   is Mindoo's; the body then re-checks `requireLeadAccess` for the specific
   lead and reads it under `ctx.brand`, so a B-Systems lead id typed into this
   URL 404s rather than rendering. Neither wall alone is enough: the first does
   not know which lead, the second does not know which app. */

export default async function MindooLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  await requireMindooPage();
  const { leadId } = await params;
  return <BsLeadDetailBody ctx={MINDOO_SURFACE} leadId={leadId} />;
}
