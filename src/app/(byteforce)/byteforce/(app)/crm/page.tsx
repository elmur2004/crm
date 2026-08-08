import { CrmBoardBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "CRM — ByteForce CRM" };

export default function Page() {
  return <CrmBoardBody ctx={BYTEFORCE_CTX} />;
}
