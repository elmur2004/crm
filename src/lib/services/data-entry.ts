import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { isDataEntry, type RoleBearer } from "@/lib/auth/roles";
import { notifyAdmins } from "./notifications";

/* ADR-051 — the data-entry role.

   Founder: "I want to add a type of user called data entry. This user is just
   able to add leads or partners or agents... They are just adding, and they
   will not be the owner of what they add. It will be with no owner until the
   admin decides which owner is these leads."

   Two ideas live here and nowhere else:
   1. WHAT THEY ENTERED — read from Lead/PartnerProspect.createdByUserId, which
      every create path stamps (audit data whoever typed it).
   2. WHETHER THEY MAY STILL CORRECT IT — a typo fixed a minute later is the
      same act as typing it; an edit after someone has picked the record up is
      not. "Untouched" is therefore defined narrowly and structurally, never by
      a clock: still in the intake column, and nobody has taken it. */

/** A lead is still the data-entry user's to fix while it sits unassigned in
    intake: no owner, no rep, no stage movement, not archived. */
const LEAD_UNTOUCHED = {
  stage: "new",
  ownerUserId: null,
  salesRepId: null,
  archived: false,
} as const;

/** A card is still theirs to fix while it sits in the intake column and has not
    been converted into a partner or an agent account. */
const PROSPECT_UNTOUCHED = { stage: "lead", converted: false } as const;

export async function listMyEntries(userId: string) {
  const [leads, prospects] = await Promise.all([
    db.lead.findMany({
      where: { createdByUserId: userId, brand: "bsystems" },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { owner: { select: { name: true } }, salesRep: { select: { name: true } } },
    }),
    db.partnerProspect.findMany({
      where: { createdByUserId: userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);
  return {
    leads: leads.map((l) => ({
      ...l,
      editable:
        l.stage === LEAD_UNTOUCHED.stage &&
        l.ownerUserId === null &&
        l.salesRepId === null &&
        !l.archived,
    })),
    prospects: prospects.map((p) => ({
      ...p,
      editable: p.stage === PROSPECT_UNTOUCHED.stage && !p.converted,
    })),
  };
}

/** Server-side gate for "correct what I just typed". Admins are unaffected —
    they own every record anyway; this only ever WIDENS data entry's rights, and
    only over rows it created that nobody has touched. Throws otherwise. */
export async function assertCanCorrect(
  user: RoleBearer,
  target: { kind: "lead"; id: string } | { kind: "prospect"; id: string },
): Promise<void> {
  if (!isDataEntry(user)) throw new ApiError(403, "You do not have access to this area");
  const row =
    target.kind === "lead"
      ? await db.lead.findFirst({
          where: { id: target.id, createdByUserId: user.id, brand: "bsystems", ...LEAD_UNTOUCHED },
          select: { id: true },
        })
      : await db.partnerProspect.findFirst({
          where: { id: target.id, createdByUserId: user.id, ...PROSPECT_UNTOUCHED },
          select: { id: true },
        });
  if (!row) {
    throw new ApiError(
      403,
      "You can only correct an entry you added, and only while nobody has picked it up",
    );
  }
}

/** Founder: what a data-entry user adds "will be with no owner until the admin
    decides which owner is these leads" — so the admin has to LEARN it exists.
    Same broadcast the ready-to-close flag uses, deep-linked through leadId. */
export async function notifyAdminsOfEntry(input: {
  leadId: string;
  leadName: string;
  by: string;
}): Promise<void> {
  await notifyAdmins({
    type: "needs_owner",
    title: `New lead added by ${input.by} — needs an owner`,
    body: `${input.by} entered "${input.leadName}". It is unassigned until you give it an owner.`,
    leadId: input.leadId,
  });
}
