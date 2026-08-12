import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  addLeadComment,
  listLeadComments,
  mentionableUsersFor,
  resolveMentions,
} from "./comments";
import { createLead, deleteLead } from "./leads";
import type { Actor } from "./activity";

/* Founder: the lead mini chat — mentions resolve ONLY against people who can
   open the lead, mentioned teammates get a bell notification, the thread dies
   with the lead. */

const actor: Actor = { id: null, label: "Test" };

async function makeUser(name: string, role: string, email: string) {
  const user = await db.user.create({
    data: { name, email, passwordHash: "x", roles: { create: [{ role }] } },
  });
  return user;
}

beforeEach(async () => {
  await resetDb();
});

describe("Lead chat (founder V5)", () => {
  it("mentionable set = exactly who can open the lead", async () => {
    const admin = await makeUser("Elmur", "bsystems_admin", "a@x.com");
    const sales = await makeUser("Sara Sales", "bsystems_sales", "s@x.com");
    const agent = await makeUser("Omar Agent", "bsystems_agent", "o@x.com");
    const otherAgent = await makeUser("Nour Agent", "bsystems_agent", "n@x.com");
    const bfStaff = await makeUser("Bassem BF", "byteforce_staff", "b@x.com");

    /* Agent-owned B-Systems lead → the owner + admins. NOT sales, NOT other agents. */
    const agentLead = await createLead(
      "bsystems",
      { name: "Chat Corp", number: "0100000001", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    const set1 = (await mentionableUsersFor(agentLead.id)).map((m) => m.name).sort();
    expect(set1).toEqual(["Elmur", "Omar Agent"]);

    /* Internal B-Systems lead → admins + internal sales. */
    const internalLead = await createLead(
      "bsystems",
      { name: "Internal Corp", number: "0100000002", type: "cold_call" },
      actor,
    );
    const set2 = (await mentionableUsersFor(internalLead.id)).map((m) => m.name).sort();
    expect(set2).toEqual(["Elmur", "Sara Sales"]);

    /* ByteForce lead → ByteForce staff only. */
    const bfLead = await createLead(
      "byteforce",
      { name: "BF Corp", number: "0100000003", type: "cold_call" },
      actor,
    );
    const set3 = (await mentionableUsersFor(bfLead.id)).map((m) => m.name);
    expect(set3).toEqual(["Bassem BF"]);
    expect(set3).not.toContain(otherAgent.name);
  });

  it("resolveMentions: longest name first, case-insensitive, unknown names ignored", () => {
    const allowed = [
      { userId: "1", name: "Omar" },
      { userId: "2", name: "Omar Agent" },
    ];
    expect(resolveMentions("ping @omar agent about this", allowed)).toEqual([
      { userId: "2", name: "Omar Agent" },
    ]);
    expect(resolveMentions("ping @Omar only", allowed)).toEqual([{ userId: "1", name: "Omar" }]);
    expect(resolveMentions("no mention @Stranger", allowed)).toEqual([]);
  });

  it("resolveMentions respects word boundaries — no emails, no prefixes", () => {
    const allowed = [
      { userId: "1", name: "Ali" },
      { userId: "2", name: "Nour" },
    ];
    /* "@Ali" must not fire inside "@Alina", nor "@nour" inside an email. */
    expect(resolveMentions("ask @Alina about it", allowed)).toEqual([]);
    expect(resolveMentions("their email is sara@nour-trading.com", allowed)).toEqual([]);
    expect(resolveMentions("ping @Ali.", allowed)).toEqual([{ userId: "1", name: "Ali" }]);
  });

  it("an owner whose roles no longer pass the lead guard drops out of the mentionable set", async () => {
    await makeUser("Elmur", "bsystems_admin", "a@x.com");
    const agent = await makeUser("Omar Agent", "bsystems_agent", "o@x.com");
    const lead = await createLead(
      "bsystems",
      { name: "Chat Corp", number: "0100000001", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    expect((await mentionableUsersFor(lead.id)).map((m) => m.name)).toContain("Omar Agent");

    /* The admin converts Omar to internal sales — his old agent-bucket lead
       must stop offering him as a mention (requireLeadAccess denies him). */
    await db.userRole.deleteMany({ where: { userId: agent.id } });
    await db.userRole.create({ data: { userId: agent.id, role: "bsystems_sales" } });
    expect((await mentionableUsersFor(lead.id)).map((m) => m.name)).not.toContain("Omar Agent");
  });

  it("a comment stores resolved mentions and notifies the mentioned teammate (not the author)", async () => {
    const admin = await makeUser("Elmur", "bsystems_admin", "a@x.com");
    const agent = await makeUser("Omar Agent", "bsystems_agent", "o@x.com");
    const lead = await createLead(
      "bsystems",
      { name: "Chat Corp", number: "0100000001", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );

    const comment = await addLeadComment({
      leadId: lead.id,
      body: "@Elmur what did they say on the last call? @Omar Agent take notes",
      author: { id: agent.id, name: agent.name },
    });
    expect(comment.mentions.map((m) => m.userId).sort()).toEqual([admin.id, agent.id].sort());

    /* Only the OTHER person is notified; the notification deep-links the lead. */
    const notifications = await db.notification.findMany({ where: { type: "mention" } });
    expect(notifications).toHaveLength(1);
    expect(notifications[0]!.userId).toBe(admin.id);
    expect(notifications[0]!.leadId).toBe(lead.id);
    expect(notifications[0]!.title).toContain("Omar Agent");

    /* The chat shows in the activity history. */
    const log = await db.activityLog.findFirst({
      where: { entityType: "lead", entityId: lead.id, action: "comment" },
    });
    expect(log?.trigger).toBe("lead_chat");

    const listed = await listLeadComments(lead.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]!.authorLabel).toBe("Omar Agent");
  });

  it("byteforce mention notifications carry no lead deep-link (the bell is B-Systems chrome)", async () => {
    const a = await makeUser("Bassem BF", "byteforce_staff", "b@x.com");
    const b = await makeUser("Farah BF", "byteforce_staff", "f@x.com");
    const lead = await createLead(
      "byteforce",
      { name: "BF Corp", number: "0100000003", type: "cold_call" },
      actor,
    );
    await addLeadComment({
      leadId: lead.id,
      body: "@Farah BF can you take this one?",
      author: { id: a.id, name: a.name },
    });
    const n = await db.notification.findFirstOrThrow({ where: { type: "mention" } });
    expect(n.userId).toBe(b.id);
    expect(n.leadId).toBeNull();
    expect(n.body).toContain("BF Corp");
  });

  it("the thread dies with the lead (DB-level cascade)", async () => {
    const agent = await makeUser("Omar Agent", "bsystems_agent", "o@x.com");
    const lead = await createLead(
      "bsystems",
      { name: "Chat Corp", number: "0100000001", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    await addLeadComment({
      leadId: lead.id,
      body: "context before deletion",
      author: { id: agent.id, name: agent.name },
    });
    expect(await db.leadComment.count()).toBe(1);
    await deleteLead("bsystems", lead.id, actor);
    expect(await db.leadComment.count()).toBe(0);
  });

  it("an empty or oversized message is rejected", async () => {
    const agent = await makeUser("Omar Agent", "bsystems_agent", "o@x.com");
    const lead = await createLead(
      "bsystems",
      { name: "Chat Corp", number: "0100000001", type: "cold_call" },
      actor,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    await expect(
      addLeadComment({ leadId: lead.id, body: "   ", author: { id: agent.id, name: agent.name } }),
    ).rejects.toThrow();
    await expect(
      addLeadComment({
        leadId: lead.id,
        body: "x".repeat(2001),
        author: { id: agent.id, name: agent.name },
      }),
    ).rejects.toThrow();
  });
});
