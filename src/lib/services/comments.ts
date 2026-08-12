import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/api-error";
import { writeLog } from "./activity";

/* Founder: a mini chat inside every lead — the team asks questions, follows up
   and @mentions each other so whoever talks to the lead has the full picture.
   Route-level access = requireLeadAccess (admin any / sales internal / agent+
   partner own / ByteForce staff). Mentions resolve SERVER-SIDE against the set
   of users who can actually open the lead — a mention can never leak a lead to
   someone outside it. */

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(2000),
});

export type Mention = { userId: string; name: string };

/** Everyone who can open this lead — the mentionable (and notifiable) set. */
export async function mentionableUsersFor(leadId: string): Promise<Mention[]> {
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { brand: true, ownerType: true, ownerUserId: true },
  });
  if (!lead) throw new ApiError(404, "Lead not found");

  const where =
    lead.brand === "byteforce"
      ? { roles: { some: { role: "byteforce_staff" } } }
      : {
          OR: [
            { roles: { some: { role: "bsystems_admin" } } },
            ...(lead.ownerType === "internal"
              ? [{ roles: { some: { role: "bsystems_sales" } } }]
              : []),
            /* the owner counts only while they hold a role that passes
               requireLeadAccess — a role change must not keep leaking the
               lead's chat into their mentions */
            ...(lead.ownerUserId
              ? [
                  {
                    id: lead.ownerUserId,
                    roles: {
                      some: {
                        role: { in: ["bsystems_agent", "bsystems_partner", "bsystems_admin"] },
                      },
                    },
                  },
                ]
              : []),
          ],
        };
  const users = await db.user.findMany({
    where: { ...where, active: true, registrationStatus: "approved" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((u) => ({ userId: u.id, name: u.name }));
}

/** Finds @Name tokens in the body against the allowed set — longest names match
    first so "@Ibrahim Elmur" wins over a hypothetical "@Ibrahim". */
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function resolveMentions(body: string, allowed: Mention[]): Mention[] {
  const found: Mention[] = [];
  const sorted = [...allowed].sort((a, b) => b.name.length - a.name.length);
  let scan = body;
  for (const m of sorted) {
    if (found.some((f) => f.userId === m.userId)) continue;
    /* word-boundaried: "@Ali" must not fire inside "@Alina" or "sara@ali.com" */
    const re = new RegExp(`(?<=^|[^A-Za-z0-9@])@${escapeRe(m.name)}(?![A-Za-z0-9])`, "i");
    const match = re.exec(scan);
    if (match) {
      found.push(m);
      // mask the span so "@Omar" can't re-match inside "@Omar Agent"
      scan =
        scan.slice(0, match.index) +
        " ".repeat(match[0].length) +
        scan.slice(match.index + match[0].length);
    }
  }
  return found;
}

export async function listLeadComments(leadId: string) {
  const rows = await db.leadComment.findMany({
    where: { leadId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    authorUserId: r.authorUserId,
    authorLabel: r.authorLabel,
    body: r.body,
    mentions: JSON.parse(r.mentions) as Mention[],
    createdAt: r.createdAt,
  }));
}

export async function addLeadComment(opts: {
  leadId: string;
  body: string;
  author: { id: string; name: string };
  /** impersonation transparency: "Omar Agent (via Elmur)" — chat is read as a
      person's own words, so acting-as must be visible and audited */
  via?: string;
}) {
  const { body } = addCommentSchema.parse({ body: opts.body });
  const lead = await db.lead.findUnique({
    where: { id: opts.leadId },
    select: { id: true, name: true, brand: true },
  });
  if (!lead) throw new ApiError(404, "Lead not found");

  const allowed = await mentionableUsersFor(lead.id);
  const mentions = resolveMentions(body, allowed);
  const authorLabel = opts.via ? `${opts.author.name} (via ${opts.via})` : opts.author.name;

  const comment = await db.$transaction(async (tx) => {
    const created = await tx.leadComment.create({
      data: {
        leadId: lead.id,
        authorUserId: opts.author.id,
        authorLabel,
        body,
        mentions: JSON.stringify(mentions),
      },
    });
    /* Mentioned teammates get a bell notification (self-mentions don't).
       Each brand has its own bell; byteforce rows stay deep-link-less (leadId
       null) because a dual-role user's OTHER bell would link the wrong app —
       the body names the lead instead. */
    for (const m of mentions) {
      if (m.userId === opts.author.id) continue;
      await tx.notification.create({
        data: {
          userId: m.userId,
          type: "mention",
          title: `${authorLabel} mentioned you`,
          body: `${lead.name}: ${body.slice(0, 140)}`,
          leadId: lead.brand === "bsystems" ? lead.id : null,
        },
      });
    }
    await writeLog(tx, {
      entityType: "lead",
      entityId: lead.id,
      actor: { id: opts.author.id, label: authorLabel },
      action: "comment",
      trigger: "lead_chat",
    });
    return created;
  });

  return {
    id: comment.id,
    authorUserId: comment.authorUserId,
    authorLabel: comment.authorLabel,
    body: comment.body,
    mentions,
    createdAt: comment.createdAt,
  };
}
