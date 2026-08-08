import { LeadsBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "../ctx";

export const metadata = { title: "Leads — B-Systems CRM" };

export default function Page() {
  return <LeadsBody ctx={BSYSTEMS_CTX} />;
}
