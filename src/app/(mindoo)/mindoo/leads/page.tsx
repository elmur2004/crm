import { requireMindooPage } from "@/lib/crm/mindoo";
import { MINDOO_SURFACE } from "@/lib/crm/surface";
import { BsLeadsBody, type BsLeadsParams } from "@/components/bsystems/pages/BsLeadsBody";

export const metadata = { title: "Leads — Mindoo" };

/* ADR-074 — Mindoo's Leads: the flat filterable table, not ByteForce's rep
   directory. That follows from the founder's own answer when asked which of the
   two pipelines Mindoo copies — B-Systems' — and from what a rep directory is
   for: a company with one staff account has no reps to browse.

   The owner-bucket filter still renders, and its Agents / Partners buckets will
   always be empty here. That is a TRUE statement about Mindoo rather than a
   gap — it has neither — and hiding the control would mean forking the body,
   which is the drift this whole restructure exists to avoid. */

export default async function MindooLeadsPage({
  searchParams,
}: {
  searchParams: Promise<BsLeadsParams>;
}) {
  await requireMindooPage();
  return <BsLeadsBody ctx={MINDOO_SURFACE} params={await searchParams} />;
}
