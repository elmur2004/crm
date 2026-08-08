import { CrmBoardBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "../ctx";

export const metadata = { title: "CRM — B-Systems CRM" };

export default function Page() {
  return <CrmBoardBody ctx={BSYSTEMS_CTX} />;
}
