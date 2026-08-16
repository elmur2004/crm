import { db } from "@/lib/db";
import type { Prisma } from "../../../generated/prisma/client";

/* V2 §10 — in-app notifications. userId=null rows broadcast to every admin; the
   nav bell polls (ADR-009 pattern). WhatsApp delivery is future scope (the agent
   confirmation copy references it only). */

export async function notifyAdmins(input: {
  type: "meeting_request" | "ready_to_close" | "registration";
  title: string;
  body: string;
  leadId?: string;
}) {
  await db.notification.create({
    data: {
      userId: null, // broadcast to admins
      type: input.type,
      title: input.title,
      body: input.body,
      leadId: input.leadId ?? null,
    },
  });
}

/* Founder (lead assignment): "it will be visible in his system". A notification
   addressed to ONE account — their bell already polls the same endpoint and
   deep-links through Notification.leadId to the lead. Written inside the
   assigning transaction so the ownership change and the news are atomic. */
export async function notifyUser(
  tx: Prisma.TransactionClient,
  input: { userId: string; type: "assigned"; title: string; body: string; leadId?: string },
) {
  await tx.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      leadId: input.leadId ?? null,
    },
  });
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
