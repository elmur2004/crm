import { z } from "zod";
import { db } from "@/lib/db";

/* ADR-065 — the device registry.

   THE WALL: every function here takes the CALLER's own user id and can only
   ever touch that caller's devices. A user may register a device for himself
   and remove a device of his own; there is no shape of argument that reaches
   somebody else's row, and no route hands these functions an id taken from a
   request body. */

/** Exactly the JSON a browser's `PushSubscription.toJSON()` produces. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url("That is not a push endpoint").max(2000),
  keys: z.object({
    p256dh: z.string().trim().min(1).max(500),
    auth: z.string().trim().min(1).max(500),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

/** Keeps the device label short and free of anything a browser might smuggle
    into it — it is only ever shown to the person whose device it is. */
function label(userAgent: string | null): string {
  return (userAgent ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
}

/** Register (or refresh) ONE device for ONE user.

    Keyed on the ENDPOINT, never on the user: a person has several devices, and
    the same device re-subscribing must refresh its row rather than mint a
    second one. The upsert also carries the ownership rule — a device that signs
    into a DIFFERENT account re-points to whoever is signed in now, so the
    previous account can never keep pushing to a phone it no longer holds. */
export async function saveSubscription(
  userId: string,
  input: PushSubscriptionInput,
  userAgent: string | null = null,
) {
  const { endpoint, keys } = pushSubscriptionSchema.parse(input);
  return db.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: label(userAgent),
    },
    update: {
      userId,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: label(userAgent),
      lastSeenAt: new Date(),
    },
  });
}

/** Turn ONE of your OWN devices off. A foreign endpoint is a silent no-op —
    the `markNotificationRead` convention: never confirm, never deny, never
    touch. Returns how many rows went, so a caller can tell. */
export async function removeSubscription(userId: string, endpoint: string): Promise<number> {
  const { count } = await db.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return count;
}

/** Every device belonging to any of these users. */
export function subscriptionsForUsers(userIds: string[]) {
  if (userIds.length === 0) return Promise.resolve([]);
  return db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    orderBy: { createdAt: "asc" },
  });
}

/** The push service says this endpoint is GONE (404/410): the browser dropped
    the subscription, the app was uninstalled, or the device was reset. Delete
    it by endpoint — not by id — because that is the identity the push service
    just told us about. */
export async function pruneSubscription(endpoint: string): Promise<void> {
  await db.pushSubscription.deleteMany({ where: { endpoint } });
}
