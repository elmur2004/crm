import { LeadsBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "Leads — ByteForce CRM" };

export default function Page() {
  return <LeadsBody ctx={BYTEFORCE_CTX} />;
}
