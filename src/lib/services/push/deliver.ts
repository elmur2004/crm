import { db } from "@/lib/db";
import type { Brand } from "@/lib/pipeline-engine/constants";
import { pushConfigured, vapidKeys } from "./config";
import { buildPushPayload, type NotificationForPush } from "./payload";
import { PushSubscriptionGone, pushSender } from "./send";
import { pruneSubscription, subscriptionsForUsers } from "./subscriptions";

/* ADR-065 — turning one Notification row into a buzz on somebody's phone.

   Hooked into `writeNotification` (services/notifications.ts), which is the ONE
   place a Notification row is created — so every existing type pushes and every
   FUTURE type pushes, with no per-callsite work and nothing to remember. */

/** THE WALL, and it is deliberately the SAME predicate `listNotifications` uses.

    A row addressed to one account goes to that account. A row with a null
    userId is the admin broadcast, and `listNotifications` shows those to
    B-Systems ADMINS only (`isAdmin ? OR[userId:null, userId:me] : userId:me`),
    so that is exactly who may be pushed one. Deactivated and unapproved
    accounts are excluded here for the same reason `requireUser` refuses them:
    they cannot open the app, so they must not be told what is in it. */
export async function pushRecipientsFor(n: Pick<NotificationForPush, "userId">): Promise<string[]> {
  if (n.userId) {
    const user = await db.user.findUnique({
      where: { id: n.userId },
      select: { id: true, active: true, registrationStatus: true },
    });
    if (!user || !user.active || user.registrationStatus !== "approved") return [];
    return [user.id];
  }
  const admins = await db.user.findMany({
    where: {
      active: true,
      registrationStatus: "approved",
      roles: { some: { role: "bsystems_admin" } },
    },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export type PushDeliveryResult = { sent: number; pruned: number; failed: number };

/** Deliver one notification to every device of every eligible recipient.
    Never throws: a push is a courtesy channel and the in-app Notification row
    is the record. Returns counts so tests (and a future diagnostic) can see
    what happened. */
export async function deliverNotificationPush(
  n: NotificationForPush,
): Promise<PushDeliveryResult> {
  const empty: PushDeliveryResult = { sent: 0, pruned: 0, failed: 0 };
  const vapid = vapidKeys();
  if (!vapid) return empty; // not configured — the inert path, checked again here

  const userIds = await pushRecipientsFor(n);
  if (userIds.length === 0) return empty;
  const targets = await subscriptionsForUsers(userIds);
  if (targets.length === 0) return empty;

  /* the deep link needs the lead's BRAND — one narrow read, and a lead that has
     since been deleted simply yields null and lands on an app landing */
  let leadBrand: Brand | null = null;
  if (n.leadId) {
    const lead = await db.lead.findUnique({
      where: { id: n.leadId },
      select: { brand: true },
    });
    leadBrand = (lead?.brand as Brand | undefined) ?? null;
  }

  const payloadJson = JSON.stringify(buildPushPayload(n, leadBrand));
  const send = pushSender();

  /* In parallel: one push service hanging must not delay another person's
     phone, and every device of every recipient is independent. */
  const results = await Promise.all(
    targets.map(async (t): Promise<"sent" | "pruned" | "failed"> => {
      try {
        await send({ endpoint: t.endpoint, p256dh: t.p256dh, auth: t.auth }, payloadJson, vapid);
        return "sent";
      } catch (err) {
        if (err instanceof PushSubscriptionGone) {
          await pruneSubscription(t.endpoint).catch(() => undefined);
          return "pruned";
        }
        return "failed";
      }
    }),
  );

  return {
    sent: results.filter((r) => r === "sent").length,
    pruned: results.filter((r) => r === "pruned").length,
    failed: results.filter((r) => r === "failed").length,
  };
}

/* ---------------------------------------------------------------- scheduling */

const inFlight = new Set<Promise<unknown>>();

/** Fire-and-forget from the notification write.

    FIRST LINE FIRST: with no keys configured this returns before it reads a
    row, opens a connection or creates a promise — so the write path is byte for
    byte what it was before this feature existed.

    Deliberately NOT awaited by its caller. Two of the three write paths sit
    INSIDE a database transaction (the assignment and the lead-chat mention),
    and holding a transaction open across a network round-trip to a push service
    would put someone else's outage on this app's connection pool. The cost is
    named in ADR-065: if such a transaction later rolls back, a phone may buzz
    for something that did not happen, while the bell — the record — correctly
    shows nothing. Push is the courtesy; the row is the truth. */
export function schedulePush(n: NotificationForPush): void {
  if (!pushConfigured()) return;
  const p = deliverNotificationPush(n)
    .catch((err: unknown) => {
      /* never re-thrown: an unhandled rejection here would take a request down
         for a notification that has already been safely written. The message is
         trimmed and carries no key material — VAPID keys never appear in a
         web-push error. */
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[push] delivery failed: ${message.slice(0, 200)}`);
    })
    .finally(() => {
      inFlight.delete(p);
    });
  inFlight.add(p);
}

/** Wait for whatever `schedulePush` currently has in the air. Used by the
    integration tests (a fire-and-forget is otherwise unobservable) and safe for
    a future graceful-shutdown hook. */
export function pushDeliveriesSettled(): Promise<unknown> {
  return Promise.all([...inFlight]);
}
