import { ClientsBody } from "@/components/internal/pages";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "Clients — ByteForce CRM" };

export default function Page() {
  return <ClientsBody ctx={BYTEFORCE_CTX} />;
}
