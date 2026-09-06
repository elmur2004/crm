import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { toPiasters } from "@/lib/money";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { writeLog, type Actor } from "./activity";

/* ============================================================================
   ADR-078 — CORRECTING A PROPOSAL.

   Founder: "put an edit button in the proposal inside the lead."

   Until now a proposal was write-once. Mistype the value and the only way out
   was to add a SECOND proposal record — which is not a correction, it is a
   re-quote: it changes the lead's history, its "latest proposal" and every
   figure derived from it, to fix a typo.

   THE ADMIN ONLY, which is his answer when asked, and the right one: this
   number is what `latestProposalValue` reads (ADR-012), so it drives the
   pipeline figure, the Won gate's prefill and — through the Won deal — the
   commission an agent is paid. A control that moves somebody's commission
   belongs to the person who owns the company, not to the person being paid.

   `isAdmin` from `requireLeadAccess` is exactly that, per company: B-Systems'
   admin, Mindoo's staff (which IS its whole staff, ADR-073), and — deliberately
   — nobody on ByteForce, which has no admin role at all. Flagged for him.

   TWO FIELDS, service and amount: the things a person mistypes. `sent`/`sentAt`
   are deliberately not editable here — they record something that HAPPENED, and
   the board's own action is what sets them. Editing a fact about the past is a
   different feature with a different name.

   NOT UNDOABLE, and that is a decision rather than an omission. ADR-045's undo
   is a snapshot-inverse contract with its own kinds and its own guards; adding
   one for a field edit would mean a new kind, a new inverse and a new way for
   the stack to disagree with itself. An edit is already reversible by editing
   again, and the activity log records that it happened.
   ========================================================================== */

export const proposalEditSchema = z.object({
  service: z.string().trim().min(1, "Name the service.").max(200),
  /* in the lead's own currency, as typed; stored as minor units like every
     other amount (ADR-018/077 — Mindoo's are riyals, the others' are pounds) */
  estimatedValue: z.union([z.string(), z.number()]),
});

export type ProposalEditInput = z.infer<typeof proposalEditSchema>;

/** Edit a proposal's service and amount. The BRAND is the wall: a proposal of
    another company is 404, never 403 — an id the caller may not touch must not
    be confirmed to exist (the ruling since ADR-073). */
export async function updateProposal(
  proposalId: string,
  brand: Brand,
  input: ProposalEditInput,
  actor: Actor,
) {
  const proposal = await db.proposal.findUnique({
    where: { id: proposalId },
    include: { lead: { select: { id: true, brand: true, archived: true } } },
  });
  if (!proposal || !proposal.lead || proposal.lead.brand !== brand) {
    throw new ApiError(404, "Proposal not found");
  }
  /* ADR-043 — an archived lead is READ-ONLY, and its records are part of it.
     Without this, archiving would stop being the freeze it is documented to be. */
  if (proposal.lead.archived) throw new ApiError(400, "Unarchive this lead first");

  const estimatedValue = toPiasters(input.estimatedValue);
  return db.$transaction(async (tx) => {
    const updated = await tx.proposal.update({
      where: { id: proposal.id },
      data: { service: input.service, estimatedValue },
    });
    /* logged against the LEAD, where a reader looks for this deal's history —
       the proposal is a record inside it, not a thing with a page of its own */
    await writeLog(tx, {
      entityType: "lead",
      entityId: proposal.lead!.id,
      actor,
      action: "update",
      trigger: "proposal_edited",
    });
    return updated;
  });
}
