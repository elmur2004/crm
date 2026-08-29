import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { writeLog, type Actor } from "./activity";

/* ADR-069 — the WhatsApp mark.

   Founder, verbatim: "when I click on the WhatsApp button, it should turn to be
   green to signal that I already sent WhatsApp to that prospect or to that lead,
   and it signals not just for my user, for any user that we have contacted this
   lead through WhatsApp."

   Three rules this module exists to keep:

   1. THE MARK IS ON THE RECORD. It is three columns on the Lead / the
      PartnerProspect, so every reader of that record sees the same answer —
      never per-viewer state and never browser storage.

   2. THE FIRST MESSAGE IS THE ONE THAT IS KEPT. The write is a CONDITIONAL
      update — `whatsappSentAt: null` sits in the WHERE — so a second press
      cannot overwrite who did the due diligence first, and two simultaneous
      presses cannot interleave into a half-written row. There is no unmark
      (founder: the mark exists to say the diligence was done; erasing it
      quietly would defeat it).

   3. EVERY PRESS IS STILL RECORDED. The columns keep the first message; the
      ActivityLog keeps them all, one `whatsapp_sent` row per press with its own
      actor and instant. That is deliberately where "who messaged them most
      recently" lives: a second pair of columns would compete with the chip for
      meaning, and the history panel already renders this.

   The actor always arrives from the ROUTE, which reads it off the session —
   never from the request body. */

/** What the chip needs to paint itself, on any surface. */
export type WhatsappMark = {
  sentAt: Date | null;
  sentByLabel: string | null;
};

const MARK_TRIGGER = "whatsapp_sent";

/** Founder: a lead that has been archived can still be messaged — archiving is
    a soft-hide of the CARD, and this records something that really happened
    rather than moving the pipeline. It is deliberately NOT behind
    `assertNotArchived`: the chip's mark is fire-and-forget (see the client), so
    a refusal here would be a silent no-op rather than a message to anybody. */
export async function markLeadWhatsappSent(
  brand: Brand,
  leadId: string,
  actor: Actor,
): Promise<WhatsappMark> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { id: true, brand: true },
  });
  /* the brand wall, exactly as getLead states it: /api/byteforce can never
     reach a B-Systems row and vice versa */
  if (!lead || lead.brand !== brand) throw new ApiError(404, "Lead not found");

  return db.$transaction(async (tx) => {
    /* first-press-wins, ATOMICALLY: the null guard lives in the WHERE, so the
       second of two racing presses matches no row and changes nothing — where a
       read-then-write would let the later press clobber the earlier record.

       RAW, and that is the point (the `normaliseProspectStages` precedent).
       Prisma applies `@updatedAt` CLIENT-side, so `updateMany` would stamp
       `updatedAt = now()` on a record whose pipeline state this press did not
       touch, and two things ride on that column: undo's integrity FINGERPRINT
       (the founder's pending "Undo — flagged as no answer" would 409 for ever
       after he opened WhatsApp) and the board's `orderBy: { updatedAt: "desc" }`
       (the card would jump to the top of its column for a message we sent).
       ADR-069 §4 makes the mark a SIDE EFFECT of opening WhatsApp; a side
       effect that reorders his board and kills his Undo is not one.

       It needs no `invalidateUndo` for the same reason: ADR-045's honesty rule
       exists so the button never offers an inverse that cannot apply, and this
       write moves nothing any inverse restores — the entry stays valid, the
       pill still names the action it will revert, and undoing it leaves the
       mark standing. The columns are literals; the values are bound. */
    await tx.$executeRaw`
      UPDATE "Lead"
         SET "whatsappSentAt" = ${new Date()},
             "whatsappSentById" = ${actor.id},
             "whatsappSentByLabel" = ${actor.label}
       WHERE "id" = ${leadId} AND "whatsappSentAt" IS NULL`;
    await writeLog(tx, {
      entityType: "lead",
      entityId: leadId,
      actor,
      action: "update",
      trigger: MARK_TRIGGER,
    });
    const fresh = await tx.lead.findUniqueOrThrow({
      where: { id: leadId },
      select: { whatsappSentAt: true, whatsappSentByLabel: true },
    });
    return { sentAt: fresh.whatsappSentAt, sentByLabel: fresh.whatsappSentByLabel };
  });
}

/** The partner/agent card — the same mark, for the record that wears the same
    chip on the board, on its detail, behind the partner directory row and
    (through `agentUserId`) in the Agents list. */
export async function markProspectWhatsappSent(
  prospectId: string,
  actor: Actor,
): Promise<WhatsappMark> {
  const prospect = await db.partnerProspect.findUnique({
    where: { id: prospectId },
    select: { id: true },
  });
  if (!prospect) throw new ApiError(404, "Partner prospect not found");

  return db.$transaction(async (tx) => {
    /* same conditional write, and raw for the same reason as the lead's: the
       partners board orders by `updatedAt desc` too, and a prospect carries
       undoable events of its own (ADR-045's `prospect_event`) */
    await tx.$executeRaw`
      UPDATE "PartnerProspect"
         SET "whatsappSentAt" = ${new Date()},
             "whatsappSentById" = ${actor.id},
             "whatsappSentByLabel" = ${actor.label}
       WHERE "id" = ${prospectId} AND "whatsappSentAt" IS NULL`;
    await writeLog(tx, {
      entityType: "partner_prospect",
      entityId: prospectId,
      actor,
      action: "update",
      trigger: MARK_TRIGGER,
    });
    const fresh = await tx.partnerProspect.findUniqueOrThrow({
      where: { id: prospectId },
      select: { whatsappSentAt: true, whatsappSentByLabel: true },
    });
    return { sentAt: fresh.whatsappSentAt, sentByLabel: fresh.whatsappSentByLabel };
  });
}
