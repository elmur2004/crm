import { RepLeadsBody } from "@/components/internal/pages";
import { requireCompanySection } from "@/lib/auth/page-guards";
import { BYTEFORCE_CTX } from "../../../ctx";

export const metadata = { title: "Rep leads — B-Systems CRM" };

/* ADR-067 — ByteForce's per-rep drill-down, in the merged shell. ByteForce-only:
   B-Systems' /b-systems/leads is a flat filterable table with owner buckets and
   has no rep directory behind it. This route is also the ONLY door to the
   ByteForce archive (?view=archived, ADR-043) and to the Unassigned bucket
   (repId is the literal "unassigned"), so it must survive the merge intact. */

export default async function MergedRepLeadsPage({
  params,
  searchParams,
}: {
  params: Promise<{ repId: string }>;
  searchParams: Promise<{ company?: string; view?: string }>;
}) {
  const { company, view } = await searchParams;
  await requireCompanySection("byteforce", company, ["byteforce_staff"]);
  const { repId } = await params;
  return <RepLeadsBody ctx={BYTEFORCE_CTX} repId={repId} archived={view === "archived"} />;
}
