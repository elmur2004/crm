import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { notifyAdmins, notifyUser } from "./notifications";
import { addLeadComment } from "./comments";
import { createLead } from "./leads";
import {
  deliverNotificationPush,
  pushDeliveriesSettled,
  pushRecipientsFor,
  schedulePush,
} from "./push/deliver";
import {
  pruneSubscription,
  removeSubscription,
  saveSubscription,
  subscriptionsForUsers,
} from "./push/subscriptions";
import { PushSubscriptionGone, setPushSenderForTests, type PushTarget } from "./push/send";
import type { NotificationForPush } from "./push/payload";
import type { Actor } from "./activity";

/* ADR-065 (founder: "I want it to shoot me actual notifications") — everything
   between a Notification row and a phone, proved with the SENDER FAKED. No test
   here needs a network, a push service or a browser: decision H.

   The two properties that matter most are at the bottom of this file — every
   notification TYPE pushes, and with no keys configured nothing happens at all. */

const KEY_VARS = ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY"] as const;
const savedEnv = Object.fromEntries(KEY_VARS.map((k) => [k, process.env[k]]));

/** The whole feature, switched on for a test. */
function configureKeys() {
  process.env.VAPID_PUBLIC_KEY = "test-public-key";
  process.env.VAPID_PRIVATE_KEY = "test-private-key";
}
function clearKeys() {
  for (const k of KEY_VARS) delete process.env[k];
}

type Sent = { endpoint: string; payload: { title: string; body: string; url: string; tag: string } };

/** A sender that records instead of sending, and can be told which endpoints
    the push service considers GONE. */
function fakeSender(gone: string[] = [], explode: string[] = []) {
  const sent: Sent[] = [];
  setPushSenderForTests(async (target: PushTarget, json: string) => {
    if (gone.includes(target.endpoint)) throw new PushSubscriptionGone(410);
    if (explode.includes(target.endpoint)) throw new Error("push service had a bad day");
    sent.push({ endpoint: target.endpoint, payload: JSON.parse(json) });
  });
  return sent;
}

let seq = 0;
async function makeUser(
  name: string,
  role: string,
  extra: Record<string, unknown> = {},
): Promise<{ id: string; name: string }> {
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${seq++}`,
      passwordHash: "x",
      roles: { create: { role } },
      ...extra,
    },
    select: { id: true, name: true },
  });
}

const sub = (endpoint: string) => ({ endpoint, keys: { p256dh: "pk", auth: "au" } });

beforeEach(async () => {
  await resetDb();
  clearKeys();
  setPushSenderForTests(null);
});

afterEach(() => {
  setPushSenderForTests(null);
  for (const k of KEY_VARS) {
    if (savedEnv[k] === undefined) delete process.env[k];
    else process.env[k] = savedEnv[k]!;
  }
});

/* ------------------------------------------------------------ the registry */

describe("the device registry, and the wall around it", () => {
  it("keeps one row per DEVICE, and refreshes rather than duplicates on re-subscribe", async () => {
    const user = await makeUser("Two Devices", "bsystems_admin");
    await saveSubscription(user.id, sub("https://push.example/phone"), "iPhone");
    await saveSubscription(user.id, sub("https://push.example/laptop"), "Chrome on Windows");
    expect(await db.pushSubscription.count()).toBe(2);

    const before = await db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/phone" },
    });
    await new Promise((r) => setTimeout(r, 5));
    await saveSubscription(
      user.id,
      { endpoint: "https://push.example/phone", keys: { p256dh: "pk2", auth: "au2" } },
      "iPhone",
    );
    const after = await db.pushSubscription.findUniqueOrThrow({
      where: { endpoint: "https://push.example/phone" },
    });
    expect(await db.pushSubscription.count()).toBe(2); // still two devices, not three
    expect(after.id).toBe(before.id);
    expect(after.p256dh).toBe("pk2"); // the browser rotated its keys; we followed
    expect(after.lastSeenAt.getTime()).toBeGreaterThan(before.lastSeenAt.getTime());
  });

  it("a user may only remove their OWN device — a foreign endpoint touches nothing", async () => {
    const mine = await makeUser("Mine", "bsystems_admin");
    const theirs = await makeUser("Theirs", "bsystems_sales");
    await saveSubscription(mine.id, sub("https://push.example/mine"));
    await saveSubscription(theirs.id, sub("https://push.example/theirs"));

    expect(await removeSubscription(mine.id, "https://push.example/theirs")).toBe(0);
    expect(await db.pushSubscription.count()).toBe(2); // silent no-op, nothing gone

    expect(await removeSubscription(mine.id, "https://push.example/mine")).toBe(1);
    const left = await db.pushSubscription.findMany({ select: { userId: true } });
    expect(left.map((r) => r.userId)).toEqual([theirs.id]);
  });

  it("a device that signs into another account RE-POINTS, so the old account stops reaching it", async () => {
    const first = await makeUser("First Owner", "bsystems_admin");
    const second = await makeUser("Second Owner", "bsystems_sales");
    await saveSubscription(first.id, sub("https://push.example/shared-phone"));
    await saveSubscription(second.id, sub("https://push.example/shared-phone"));

    expect(await db.pushSubscription.count()).toBe(1);
    expect((await subscriptionsForUsers([first.id])).length).toBe(0);
    expect((await subscriptionsForUsers([second.id])).map((s) => s.endpoint)).toEqual([
      "https://push.example/shared-phone",
    ]);
  });

  it("deleting the account takes its devices with it", async () => {
    const user = await makeUser("Leaving", "bsystems_agent");
    await saveSubscription(user.id, sub("https://push.example/leaving-1"));
    await saveSubscription(user.id, sub("https://push.example/leaving-2"));
    await db.user.delete({ where: { id: user.id } });
    expect(await db.pushSubscription.count()).toBe(0);
  });

  it("refuses anything that is not a real push subscription", async () => {
    const user = await makeUser("Bad Input", "bsystems_admin");
    await expect(
      saveSubscription(user.id, { endpoint: "not-a-url", keys: { p256dh: "pk", auth: "au" } }),
    ).rejects.toThrow();
    await expect(
      saveSubscription(user.id, {
        endpoint: "https://push.example/ok",
        keys: { p256dh: "", auth: "au" },
      }),
    ).rejects.toThrow();
    expect(await db.pushSubscription.count()).toBe(0);
  });
});

/* ------------------------------------------------------- who may be pushed */

describe("who a push may reach — the same wall the bell enforces", () => {
  it("an addressed notification reaches that one account, and nobody else", async () => {
    const target = await makeUser("Target", "bsystems_agent");
    await makeUser("Bystander", "bsystems_admin");
    expect(await pushRecipientsFor({ userId: target.id })).toEqual([target.id]);
  });

  it("a broadcast reaches every ACTIVE, APPROVED admin — and only admins", async () => {
    const admin = await makeUser("Live Admin", "bsystems_admin");
    const off = await makeUser("Deactivated Admin", "bsystems_admin", { active: false });
    const pending = await makeUser("Pending Admin", "bsystems_admin", {
      registrationStatus: "pending",
    });
    await makeUser("Sales", "bsystems_sales");
    await makeUser("Agent", "bsystems_agent");

    const recipients = await pushRecipientsFor({ userId: null });
    expect(recipients).toEqual([admin.id]);
    expect(recipients).not.toContain(off.id);
    expect(recipients).not.toContain(pending.id);
  });

  it("never pushes to a deactivated or unapproved account, even when addressed to it", async () => {
    const off = await makeUser("Locked Out", "bsystems_agent", { active: false });
    const pending = await makeUser("Awaiting", "bsystems_agent", {
      registrationStatus: "pending",
    });
    expect(await pushRecipientsFor({ userId: off.id })).toEqual([]);
    expect(await pushRecipientsFor({ userId: pending.id })).toEqual([]);
    expect(await pushRecipientsFor({ userId: "no-such-user" })).toEqual([]);
  });
});

/* ------------------------------------------------------------- delivery */

const notification = (over: Partial<NotificationForPush> = {}): NotificationForPush => ({
  id: "n-1",
  userId: null,
  type: "ready_to_close",
  title: "Ready to close: Nile Foods",
  body: "Elmur marked \"Nile Foods\" as ready to close (stage: negotiation).",
  leadId: null,
  ...over,
});

describe("delivering to real devices", () => {
  it("reaches EVERY device the recipient has", async () => {
    configureKeys();
    const admin = await makeUser("Multi Device Admin", "bsystems_admin");
    for (const e of ["phone", "laptop", "tablet"]) {
      await saveSubscription(admin.id, sub(`https://push.example/${e}`));
    }
    const sent = fakeSender();

    const result = await deliverNotificationPush(notification());
    expect(result).toEqual({ sent: 3, pruned: 0, failed: 0 });
    expect(sent.map((s) => s.endpoint).sort()).toEqual([
      "https://push.example/laptop",
      "https://push.example/phone",
      "https://push.example/tablet",
    ]);
    /* the payload carries the row's own words, and a link into the app */
    expect(sent[0]!.payload.title).toBe("Ready to close: Nile Foods");
    expect(sent[0]!.payload.url).toBe("/b-systems");
  });

  it("deep-links a lead's own app, resolving the brand from the lead", async () => {
    configureKeys();
    const admin = await makeUser("Deep Link Admin", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/deep"));
    const actor: Actor = { id: admin.id, label: admin.name };
    const bs = await createLead(
      "bsystems",
      { name: "Deep BS", number: "0101110001", type: "cold_call" },
      actor,
    );
    const bf = await createLead(
      "byteforce",
      { name: "Deep BF", number: "0101110002", type: "cold_call" },
      actor,
    );
    const sent = fakeSender();

    await deliverNotificationPush(notification({ id: "a", leadId: bs.id }));
    await deliverNotificationPush(notification({ id: "b", leadId: bf.id }));
    expect(sent.map((s) => s.payload.url)).toEqual([
      `/b-systems/crm/lead/${bs.id}?company=bsystems`,
      `/b-systems/leads/lead/${bf.id}?company=byteforce`,
    ]);
  });

  it("PRUNES a device the push service says is gone, and leaves the healthy ones alone", async () => {
    configureKeys();
    const admin = await makeUser("Pruning Admin", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/dead"));
    await saveSubscription(admin.id, sub("https://push.example/alive"));
    const sent = fakeSender(["https://push.example/dead"]);

    const result = await deliverNotificationPush(notification());
    expect(result).toEqual({ sent: 1, pruned: 1, failed: 0 });
    expect(sent.map((s) => s.endpoint)).toEqual(["https://push.example/alive"]);
    expect((await db.pushSubscription.findMany()).map((s) => s.endpoint)).toEqual([
      "https://push.example/alive",
    ]);
  });

  it("keeps a device whose push service merely HICCUPED — a 500 is not a goodbye", async () => {
    configureKeys();
    const admin = await makeUser("Hiccup Admin", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/flaky"));
    fakeSender([], ["https://push.example/flaky"]);

    const result = await deliverNotificationPush(notification());
    expect(result).toEqual({ sent: 0, pruned: 0, failed: 1 });
    expect(await db.pushSubscription.count()).toBe(1); // still registered
  });

  it("prunes by ENDPOINT, whoever it belongs to", async () => {
    const a = await makeUser("Owner A", "bsystems_admin");
    await saveSubscription(a.id, sub("https://push.example/prune-me"));
    await pruneSubscription("https://push.example/prune-me");
    expect(await db.pushSubscription.count()).toBe(0);
    await pruneSubscription("https://push.example/never-existed"); // no throw
  });

  it("does nothing at all when the recipient has no device", async () => {
    configureKeys();
    await makeUser("Deviceless Admin", "bsystems_admin");
    const sent = fakeSender();
    expect(await deliverNotificationPush(notification())).toEqual({
      sent: 0,
      pruned: 0,
      failed: 0,
    });
    expect(sent).toEqual([]);
  });
});

/* --------------------------------------------- every type, and the flag off */

describe("EVERY notification type reaches the phone (the one central hook)", () => {
  it("pushes for each of the six types, because they all write through one place", async () => {
    configureKeys();
    const admin = await makeUser("Elmur", "bsystems_admin", {
      email: "push-admin@example.test",
    });
    const agent = await makeUser("Karim Push", "bsystems_agent");
    await saveSubscription(admin.id, sub("https://push.example/admin-phone"));
    await saveSubscription(agent.id, sub("https://push.example/agent-phone"));
    const sent = fakeSender();
    const actor: Actor = { id: admin.id, label: admin.name };

    /* the four admin broadcasts */
    for (const type of [
      "meeting_request",
      "ready_to_close",
      "registration",
      "needs_owner",
    ] as const) {
      await notifyAdmins({ type, title: `${type} title`, body: `${type} body` });
    }
    /* the addressed one */
    await db.$transaction(async (tx) => {
      await notifyUser(tx, {
        userId: agent.id,
        type: "assigned",
        title: "Assigned to you: Push Corp",
        body: "Elmur made you the owner.",
      });
    });
    /* and the lead-chat mention, which used to bypass the helper entirely */
    const lead = await createLead(
      "bsystems",
      { name: "Push Corp", number: "0101119999", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    await addLeadComment({
      leadId: lead.id,
      body: "@Karim Push please call them today",
      author: { id: admin.id, name: admin.name },
    });

    await pushDeliveriesSettled();

    const titles = sent.map((s) => s.payload.title);
    expect(titles).toContain("meeting_request title");
    expect(titles).toContain("ready_to_close title");
    expect(titles).toContain("registration title");
    expect(titles).toContain("needs_owner title");
    expect(titles).toContain("Assigned to you: Push Corp");
    expect(titles).toContain("Elmur mentioned you");
    /* six rows written, six pushes out — one per notification, no type missed */
    expect(await db.notification.count()).toBe(6);
    expect(sent).toHaveLength(6);

    /* and each went to the RIGHT phone: the broadcasts to the admin, the two
       addressed ones to the agent */
    const byTitle = Object.fromEntries(sent.map((s) => [s.payload.title, s.endpoint]));
    expect(byTitle["ready_to_close title"]).toBe("https://push.example/admin-phone");
    expect(byTitle["Assigned to you: Push Corp"]).toBe("https://push.example/agent-phone");
    expect(byTitle["Elmur mentioned you"]).toBe("https://push.example/agent-phone");
  });

  it("WITH NO KEYS CONFIGURED, nothing is sent and everything else is unchanged", async () => {
    clearKeys(); // production, before the founder sets anything
    const admin = await makeUser("Inert Admin", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/inert"));
    const sent = fakeSender();

    await notifyAdmins({ type: "ready_to_close", title: "Quiet", body: "No phone rings" });
    await db.$transaction(async (tx) => {
      await notifyUser(tx, {
        userId: admin.id,
        type: "assigned",
        title: "Also quiet",
        body: "Still no phone",
      });
    });
    await pushDeliveriesSettled();

    /* not one send, and no throw, no rejection, no lost notification */
    expect(sent).toEqual([]);
    expect(await db.notification.count()).toBe(2);
    /* the direct call is inert too, not merely the scheduler */
    expect(await deliverNotificationPush(notification())).toEqual({
      sent: 0,
      pruned: 0,
      failed: 0,
    });
  });

  it("a failing push never becomes an unhandled rejection on the write path", async () => {
    configureKeys();
    const admin = await makeUser("Resilient Admin", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/boom"));
    setPushSenderForTests(async () => {
      throw new Error("the push service exploded");
    });

    /* schedulePush is fire-and-forget: the notification must still be written
       and the caller must never see the failure */
    await notifyAdmins({ type: "ready_to_close", title: "Survives", body: "the explosion" });
    await expect(pushDeliveriesSettled()).resolves.toBeDefined();
    expect(await db.notification.count()).toBe(1);
    expect(await db.pushSubscription.count()).toBe(1); // a crash is not a goodbye
  });

  it("schedulePush is a no-op with the flag off, even for a well-formed notification", async () => {
    clearKeys();
    const admin = await makeUser("Flagless", "bsystems_admin");
    await saveSubscription(admin.id, sub("https://push.example/flagless"));
    const sent = fakeSender();
    schedulePush(notification());
    await pushDeliveriesSettled();
    expect(sent).toEqual([]);
  });
});
