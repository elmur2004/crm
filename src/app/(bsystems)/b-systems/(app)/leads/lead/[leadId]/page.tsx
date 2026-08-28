import { LeadDetailBody } from "@/components/internal/pages";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Lead — B-Systems CRM" };

/* ADR-067 — ByteForce's lead detail, in the merged shell. ByteForce-only: the
   B-Systems lead detail is a different screen at /b-systems/crm/lead/[leadId].

   This exact address is the one baked into web pushes already delivered to the
   founder's phone (as /byteforce/leads/lead/<id>, which the proxy redirects
   here), so the path shape is a promise, not a preference. The body itself
   re-checks the lead through requireLeadAccess, which refuses any non-ByteForce
   caller on a ByteForce lead — the company guard narrows the SCREEN, the
   service still guards the ROW. */

export default async function MergedLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  await requireCompanySection("byteforce", (await searchParams).company);
  const { leadId } = await params;
  return <LeadDetailBody ctx={BYTEFORCE_CTX} leadId={leadId} />;
}
