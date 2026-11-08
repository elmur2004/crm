import { redirect } from "next/navigation";
import { OwnerLeadsBody } from "@/components/internal/pages";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { isCompanyAdmin } from "@/lib/auth/lead-scope";
import { crmQuery } from "@/lib/crm/company";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Owner leads — B-Systems CRM" };

/* ADR-067 — ByteForce's per-OWNER drill-down, in the merged shell (it was the
   per-rep one; founder 2026-11-08 — "Both companies now" — made the owner an
   ACCOUNT, and the address is kept so every link shape still opens: `repId` is
   now an owner account's id, or the literal "unassigned"). ByteForce-only:
   B-Systems' /b-systems/leads is a flat filterable table with owner buckets.
   This route is also the ONLY door to the ByteForce archive (?view=archived,
   ADR-043) and to the Unassigned bucket.

   THE WALL: the ByteForce admin opens any owner's list; a teammate only his
   own — anybody else's id (or Unassigned) sends him back to his Leads page,
   which IS his own list. The body 404s the same case as the belt. */

export default async function MergedRepLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<{ company?: string; view?: string }>;
}) {
  const { company, view } = await searchParams;
  const { user } = await requireCompanySection("byteforce", company, ["byteforce_staff"]);
  const { repId } = await params;
  if (!isCompanyAdmin(user, "byteforce") && repId !== user.id) {
    redirect(`/b-systems/leads${crmQuery("byteforce")}`);
  }
  return (
    <OwnerLeadsBody
      ctx={BYTEFORCE_CTX}
      viewer={user}
      ownerId={repId}
      archived={view === "archived"}
    />
  );
}
