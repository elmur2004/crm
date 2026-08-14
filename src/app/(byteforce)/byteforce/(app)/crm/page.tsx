import { CrmBoardBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "CRM — ByteForce CRM" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string }>;
}) {
  return <CrmBoardBody ctx={BYTEFORCE_CTX} params={await searchParams} />;
}
