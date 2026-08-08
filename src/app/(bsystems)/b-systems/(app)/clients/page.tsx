import { ClientsBody } from "@/components/internal/pages";
import { BSYSTEMS_CTX } from "../ctx";

export const metadata = { title: "Clients — B-Systems CRM" };

export default function Page() {
  return <ClientsBody ctx={BSYSTEMS_CTX} />;
}
