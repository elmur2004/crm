import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";
import { schedulePush } from "./push/deliver";
import type { Brand } from "@/lib/pipeline-engine/constants";

/* V2 §10 — in-app notifications. userId=null rows broadcast to every admin; the
   nav bell polls (ADR-009 pattern).

   ADR-065 — and now they buzz a phone as well. Web push is hooked into
   `writeNotification` below, which is THE one place a Notification row is
   created: `notifyAdmins`, `notifyUser` and the lead-chat mention loop all go
   through it, so every existing type pushes and every FUTURE type pushes with
   no per-callsite work and nothing to remember. With no VAPID keys configured
   the hook returns before it does anything at all — see push/deliver.ts. */

/** Every kind of news this system can deliver. `needs_owner` is ADR-051 (a
    data-entry user added a lead that belongs to nobody until the admin assigns
    it); `mention` is the lead-chat @mention (founder V5); `assigned` is the
    lead handover. */
export type NotificationType =
  | "meeting_request"
  | "ready_to_close"
  | "registration"
  | "needs_owner"
  | "assigned"
  | "mention";

type NotificationInput = {
  /** null = broadcast to every B-Systems admin */
  userId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  leadId?: string | null;
};

/** THE central write. Everything that notifies anybody comes through here, so
    the push send is hooked exactly once. Accepts a transaction client so a
    caller can keep the news atomic with the change it is news about. */
async function writeNotification(
  client: Prisma.TransactionClient,
  input: NotificationInput,
) {
  const row = await client.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      leadId: input.leadId ?? null,
    },
  });
  /* fire-and-forget, and inert unless the host has VAPID keys */
  schedulePush({
    id: row.id,
    userId: row.userId,
    type: row.type,
    title: row.title,
    body: row.body,
    leadId: row.leadId,
  });
  return row;
}

/* ADR-074 — A BROADCAST HAS EXACTLY ONE AUDIENCE: the B-Systems admin bell.

   `userId: null` means "every admin", and `listNotifications({ isAdmin: true })`
   is read by /api/b-systems/notifications and by nothing else — ByteForce's and
   Mindoo's bells both ask for the PERSONAL feed. So a broadcast written for a
   Mindoo lead has no reader in Mindoo and one reader outside it: it put the
   Mindoo lead's NAME and STAGE into every B-Systems admin's bell and phone.

   The brand is therefore REQUIRED, and a non-B-Systems brand writes nothing at
   all rather than writing to somebody else's chrome. Not a silent no-op by
   omission — the argument makes every caller state which company it is
   speaking for, which is the only way this stays true. */
export async function notifyAdmins(input: {
  brand: Brand;
  type: Extract<
    NotificationType,
    "meeting_request" | "ready_to_close" | "registration" | "needs_owner"
  >;
  title: string;
  body: string;
  leadId?: string;
}) {
  if (input.brand !== "bsystems") return;
  const { brand: _brand, ...rest } = input;
  void _brand;
  await writeNotification(db, { ...rest, userId: null });
}

/* Founder (lead assignment): "it will be visible in his system". A notification
   addressed to ONE account — their bell already polls the same endpoint and
   deep-links through Notification.leadId to the lead. Written inside the
   assigning transaction so the ownership change and the news are atomic.
   ADR-065 widened it to carry the lead-chat @mention too, so that path stops
   writing its own `notification.create` and inherits the push hook. */
export async function notifyUser(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    type: Extract<NotificationType, "assigned" | "mention">;
    title: string;
    body: string;
    leadId?: string | null;
  },
) {
  await writeNotification(tx, input);
}

export function listNotifications(opts: { isAdmin: boolean; userId: string; take?: number }) {
  return db.notification.findMany({
    where: opts.isAdmin ? { OR: [{ userId: null }, { userId: opts.userId }] } : { userId: opts.userId },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
  });
}

/** Ownership-checked: a user marks only their OWN rows read (admins also the
    admin-broadcast rows). A foreign id is a silent no-op. */
export async function markNotificationRead(id: string, reader: { userId: string; isAdmin: boolean }) {
  await db.notification.updateMany({
    where: {
      id,
      OR: [{ userId: reader.userId }, ...(reader.isAdmin ? [{ userId: null }] : [])],
    },
    data: { readAt: new Date() },
  });
}
