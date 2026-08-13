import { RepLeadsBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Rep leads — ByteForce CRM" };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { repId } = await params;
  const { view } = await searchParams;
  return <RepLeadsBody ctx={BYTEFORCE_CTX} repId={repId} archived={view === "archived"} />;
}
