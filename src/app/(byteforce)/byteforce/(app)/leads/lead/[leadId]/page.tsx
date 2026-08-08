import { LeadDetailBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Lead — ByteForce CRM" };

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params;
  return <LeadDetailBody ctx={BYTEFORCE_CTX} leadId={leadId} />;
}
