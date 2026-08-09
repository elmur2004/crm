import { db } from "@/lib/db";

/* V2 §10 — in-app notifications. userId=null rows broadcast to every admin; the
   nav bell polls (ADR-009 pattern). WhatsApp delivery is future scope (the agent
   confirmation copy references it only). */

export async function notifyAdmins(input: {
  type: "meeting_request" | "ready_to_close";
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

export function listNotifications(opts: { isAdmin: boolean; userId: string; take?: number }) {
  return db.notification.findMany({
    where: opts.isAdmin ? { OR: [{ userId: null }, { userId: opts.userId }] } : { userId: opts.userId },
    orderBy: { createdAt: "desc" },
    take: opts.take ?? 30,
  });
}

export async function markNotificationRead(id: string) {
  await db.notification.update({ where: { id }, data: { readAt: new Date() } }).catch(() => null);
}
