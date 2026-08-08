import { RepLeadsBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Rep leads — ByteForce CRM" };

export default async function Page({ params }: { params: Promise<{ repId: string }> }) {
  const { repId } = await params;
  return <RepLeadsBody ctx={BYTEFORCE_CTX} repId={repId} />;
}
