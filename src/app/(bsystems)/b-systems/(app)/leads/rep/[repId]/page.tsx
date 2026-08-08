import { RepLeadsBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "../../../ctx";

export const metadata = { title: "Rep leads — B-Systems CRM" };

export default async function Page({ params }: { params: Promise<{ repId: string }> }) {
  const { repId } = await params;
  return <RepLeadsBody ctx={BSYSTEMS_CTX} repId={repId} />;
}
