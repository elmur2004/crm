import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { toPiasters } from "@/lib/money";
import { writeLog, type Actor } from "./activity";

/* ============================================================================
   ADR-077 — THE BYTEFORCE SUB-SERVICE ON A MINDOO PROPOSAL.

   Founder: "when we are sending proposals through the Mindoo platform, the
   admin and the admin only is allowed to customize the proposal that is
   appearing in the ByteForce CRM… for everyone else, they will just get the
   number and the service of Mindoo, which will be in Saudi riyal. The admin
   could customize it a little bit and say, this proposal is X amount in Saudi
   riyal, and then we will get this sub-service for ByteForce for X amount in
   Egyptian pounds."

   So a Mindoo deal has a Mindoo half and a ByteForce half, and this is the
   ByteForce half: what ByteForce delivers inside that deal, and for how much in
   pounds. It is an ANNOTATION on Mindoo's proposal, not a second proposal —
   there is one deal, one client and one quote to the prospect.

   THREE WALLS, and each answers a different question:

   1. WHOSE PROPOSAL. Only a MINDOO lead's, because the whole idea is Mindoo
      work with a ByteForce piece inside it. A B-Systems proposal reaching here
      would be a different feature nobody asked for — 404, never 403, so an id
      the caller may not annotate is not confirmed to exist (the ruling since
      ADR-073).

   2. WHO. The platform administrator, and nobody else. Not Mindoo's staff —
      "for everyone else, they will just get the number and the service of
      Mindoo" — and not ByteForce's, who never see these cards at all (ADR-076).
      Enforced at the route with `requireRole("bsystems_admin")` and asserted
      again here, because a service that trusts its caller is a service that
      gets called from somewhere new.

   3. WHICH CURRENCY. `bfValue` is EGYPTIAN POUNDS, sitting on a row whose
      `estimatedValue` is RIYALS. Nothing in this file converts between them and
      nothing sums them; see the note in lib/money.ts about why there is no rate
      in this codebase.
   ========================================================================== */

export const subServiceSchema = z.object({
  /* what ByteForce is doing inside the Mindoo deal */
  service: z.string().trim().min(1, "Name the ByteForce service.").max(200),
  /* in POUNDS as typed; stored as piasters like every other amount */
  value: z.union([z.string(), z.number()]),
});

export type SubServiceInput = z.infer<typeof subServiceSchema>;

/** The proposal, proved to be a Mindoo one. 404 otherwise. */
async function mindooProposal(proposalId: string) {
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: { select: { id: true, brand: true, name: true } } },
  });
  if (!proposal || proposal.lead?.brand !== "mindoo") {
    throw new ApiError(404, "Proposal not found");
  }
  return proposal;
}

/** Attach or replace the ByteForce sub-service on a Mindoo proposal. */
export async function setSubService(
  proposalId: string,
  input: SubServiceInput,
  actor: Actor,
) {
  const proposal = await mindooProposal(proposalId);
  const bfValue = toPiasters(input.value);
  return db.$transaction(async (tx) => {
    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: { bfService: input.service, bfValue },
    });
    /* logged against the LEAD, because that is where a reader looks for the
       history of this deal — the proposal is a record inside it */
    await writeLog(tx, {
      entityType: "lead",
      entityId: proposal.lead!.id,
      actor,
      action: "update",
      trigger: "bf_sub_service_set",
    });
    return updated;
  });
}

/** Take it off again. Distinct from setting it to zero: a sub-service worth
    nothing is a statement, an absent one is the default. */
export async function clearSubService(proposalId: string, actor: Actor) {
  const proposal = await mindooProposal(proposalId);
  return db.$transaction(async (tx) => {
    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: { bfService: null, bfValue: null },
    });
    await writeLog(tx, {
      entityType: "lead",
      entityId: proposal.lead!.id,
      actor,
      action: "update",
      trigger: "bf_sub_service_cleared",
    });
    return updated;
  });
}

/* ---------------------------------------------------------------------------
   ADR-077 — WHAT BYTEFORCE IS OWED OUT OF MINDOO'S PIPELINE.

   The founder chose, when asked, that these amounts COUNT toward ByteForce's
   pipeline value. So this is the sum of every sub-service on a Mindoo lead that
   is still live — the same "active stages only" rule ByteForce's own pipeline
   figure uses (§6.5: won and lost are not pipeline).

   It is READ ONLY WHERE THE ADMIN IS LOOKING. He also chose that only he sees
   the sub-service at all, and a figure he cannot trace is worse than one that
   is not there: ByteForce's staff keep the dashboard they have always had, and
   his own includes what Mindoo owes ByteForce. Two roles, two answers, which
   this codebase already does for commission (V2 §4) — and never two answers for
   the same role, which is the line that matters.

   LATEST PROPOSAL ONLY, matching `latestProposalValue` (ADR-012): a lead's
   value is its newest quote, not the sum of every quote it has ever had.
   --------------------------------------------------------------------------- */
export async function byteforceOwedFromMindoo(): Promise<number> {
  const leads = await db.lead.findMany({
    where: { brand: "mindoo", archived: false, stage: { notIn: ["won", "lost"] } },
    select: {
      proposals: {
        where: { bfValue: { not: null } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { bfValue: true },
      },
    },
  });
  return leads.reduce((sum, lead) => sum + (lead.proposals[0]?.bfValue ?? 0), 0);
}
