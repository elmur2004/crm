import { LeadDetailBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "../../../ctx";

export const metadata = { title: "Lead — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailBody ctx={BSYSTEMS_CTX} leadId={leadId} />;
}
