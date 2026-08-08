import { DashboardBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "./ctx";

export const metadata = { title: "Home — ByteForce CRM" };

export default function Page() {
  return <DashboardBody ctx={BYTEFORCE_CTX} />;
}
