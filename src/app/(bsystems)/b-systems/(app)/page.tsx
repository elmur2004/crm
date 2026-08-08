import { DashboardBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "./ctx";

export const metadata = { title: "Home — B-Systems CRM" };

export default function Page() {
  return <DashboardBody ctx={BSYSTEMS_CTX} />;
}
