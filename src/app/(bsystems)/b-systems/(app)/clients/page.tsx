import { ClientsBody } from "@/components/internal/pages";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BYTEFORCE_CTX } from "../ctx";

export const metadata = { title: "Clients — B-Systems CRM" };

/* ADR-067 — ByteForce's Clients, in the merged shell.

   This is a ByteForce-ONLY screen and stays one. Clients and B-Systems' Won
   Leads share only their origin (a lead reaching Won): a Client carries
   service / estimated value / collected / to-be-collected / retainer /
   technical owner, while a WonDeal carries a commission percentage in basis
   points, milestones with sequential locks, attachments and statements. No
   ByteForce lead ever gets a WonDeal and no B-Systems lead ever gets a Client.
   Aliasing them to one nav item would promise each company a screen it has no
   data for, so they are siblings — each shown only under its own company. */

export default async function MergedClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  await requireCompanySection("byteforce", (await searchParams).company);
  return <ClientsBody ctx={BYTEFORCE_CTX} />;
}
