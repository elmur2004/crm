import { requireCompanySection } from "@/lib/auth/page-guards";
import { BS_PIPELINE_ROLES } from "@/lib/crm/company";
import { BSYSTEMS_SURFACE } from "@/lib/crm/surface";
import { BsLeadDetailBody } from "@/components/bsystems/pages/BsLeadDetailBody";

export const metadata = { title: "Lead — B-Systems CRM" };

/* ADR-067 — the B-Systems lead detail. ByteForce's is a different screen at
   /b-systems/leads/lead/[leadId].

   ADR-074 — Mindoo's is the SAME BODY at its own address (/mindoo/crm/lead/…),
   not this route with a company on it. ADR-073 shared the address and had to
   carry `?company=mindoo` through every link that reached it; separating the
   apps retires that whole class of "the link dropped the company and 404'd a
   lead that plainly exists" bug, because there is no company to drop. */

export default async function BsLeadDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ leadId: string }>;
  searchParams: Promise<{ company?: string }>;
}) {
  await requireCompanySection("bsystems", (await searchParams).company, BS_PIPELINE_ROLES);
  const { leadId } = await params;
  return <BsLeadDetailBody ctx={BSYSTEMS_SURFACE} leadId={leadId} />;
}
