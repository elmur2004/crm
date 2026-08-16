import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { assignLeadOwner, createLead, setArchived } from "./leads";
import { listBsLeads, listOwnLeads } from "./bsystems-admin";
import { listAssignableOwners } from "./users";
import { todoFor } from "./todo";
import { pendingUndoFor, performUndo } from "./undo";
import type { Actor } from "./activity";

/* Founder: "inside the lead I have a button or an option to assign it to one of
   my partners or one of my agents who will be responsible for that lead, and it
   will be visible in his system and counted as his lead, and he is the owner."
   Ownership = Lead.ownerUserId + ownerType. Lead.partnerId is the PP-5 referral
   ATTRIBUTION and must never move with it. */

let seq = 0;
async function makeUser(name: string, role: string, extra: Record<string, unknown> = {}) {
  const user = await db.user.create({
    data: {
      name,
      phone: `+2010666000${seq++}`,
      passwordHash: "x",
      roles: { create: { role } },
      ...extra,
    },
  });
  return user;
}

async function makeAdmin(): Promise<Actor> {
  const user = await makeUser("Assigning Admin", "bsystems_admin");
  return { id: user.id, label: user.name };
}

beforeEach(async () => {
  await resetDb();
});

describe("Assigning a lead to an agent or a partner", () => {
  it("moves the lead onto the target's board and off the previous owner's, deriving the bucket from their role", async () => {
    const admin = await makeAdmin();
    const agentA = await makeUser("Agent A", "bsystems_agent");
    const agentB = await makeUser("Agent B", "bsystems_agent");

    const lead = await createLead(
      "bsystems",
      { name: "Handover Corp", number: "0101112223", type: "cold_call", companyName: "Handover Co" },
      admin,
      { ownerType: "agent", ownerUserId: agentA.id },
    );
    expect((await listOwnLeads(agentA.id)).map((l) => l.id)).toEqual([lead.id]);

    await assignLeadOwner(lead.id, agentB.id, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(agentB.id);
    expect(fresh.ownerType).toBe("agent");
    expect((await listOwnLeads(agentB.id)).map((l) => l.id)).toEqual([lead.id]);
    expect(await listOwnLeads(agentA.id)).toEqual([]);
  });

  it("derives partner and internal buckets from the target's role", async () => {
    const admin = await makeAdmin();
    const partnerUser = await makeUser("Partner Co Login", "bsystems_partner");
    const salesUser = await makeUser("Internal Seller", "bsystems_sales");
    const lead = await createLead(
      "bsystems",
      { name: "Bucket Corp", number: "0102223334", type: "cold_call", companyName: "Bucket Co" },
      admin,
      { ownerType: "admin", ownerUserId: admin.id! },
    );

    await assignLeadOwner(lead.id, partnerUser.id, admin);
    let fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerType).toBe("partner");
    expect((await listBsLeads("partner")).map((l) => l.id)).toEqual([lead.id]);

    await assignLeadOwner(lead.id, salesUser.id, admin);
    fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerType).toBe("internal");
    expect(fresh.ownerUserId).toBe(salesUser.id);
    expect((await listBsLeads("internal")).map((l) => l.id)).toEqual([lead.id]);
  });

  it("NEVER touches partnerId — the PP-5 referral attribution outlives every handover", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Attribution Agent", "bsystems_agent");
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Key Person",
        companyName: "Referrer LLC",
        number: "0223334445",
        businessActivity: "Consulting",
        stage: "won",
        converted: true,
      },
    });
    const partner = await db.partner.create({
      data: {
        prospectId: prospect.id,
        companyName: "Referrer LLC",
        keyPersonName: "Key Person",
        keyPersonRole: "CEO",
        address: "1 Referral St",
        number: "0223334445",
        businessActivity: "Consulting",
        importance: "high",
      },
    });
    const lead = await createLead(
      "bsystems",
      { name: "Referred Corp", number: "0103334445", type: "cold_call", companyName: "Referred Co" },
      admin,
      { attribution: { partnerId: partner.id }, ownerType: "admin" },
    );
    expect(lead.partnerId).toBe(partner.id);
    expect(lead.source).toBe("partner");

    await assignLeadOwner(lead.id, agent.id, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(agent.id);
    expect(fresh.ownerType).toBe("agent");
    expect(fresh.partnerId).toBe(partner.id); // attribution intact
    expect(fresh.source).toBe("partner");
  });

  it("notifies the new owner (deep-linked) and logs the assignment", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Notified Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Notify Corp", number: "0104445556", type: "cold_call", companyName: "Notify Co" },
      admin,
    );

    await assignLeadOwner(lead.id, agent.id, admin);

    const notes = await db.notification.findMany({ where: { userId: agent.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.type).toBe("assigned");
    expect(notes[0]!.leadId).toBe(lead.id);
    expect(notes[0]!.title).toContain("Notify Corp");

    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "assigned" },
    });
    expect(log).not.toBeNull();
    expect(log!.actorLabel).toBe("Assigning Admin");
  });

  it("the lead counts as theirs everywhere: the To-Do projection follows the new owner", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Todo Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Scoped Corp", number: "0105556667", type: "cold_call", companyName: "Scoped Co" },
      admin,
    );
    await db.lead.update({ where: { id: lead.id }, data: { stage: "following_up" } });
    const now = new Date("2026-08-20T09:00:00.000Z");
    await db.followUp.create({
      data: { leadId: lead.id, context: "initial", dueAt: now, method: "call" },
    });

    expect(
      (await todoFor({ brand: "bsystems", scope: { kind: "own", userId: agent.id }, now })).today,
    ).toEqual([]);

    await assignLeadOwner(lead.id, agent.id, admin);

    const mine = await todoFor({
      brand: "bsystems",
      scope: { kind: "own", userId: agent.id },
      now,
    });
    expect(mine.today.map((i) => i.title)).toEqual(["Scoped Corp"]);
  });

  it("undo returns the lead to the previous owner and bucket", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Undo Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Undo Assign Corp", number: "0106667778", type: "cold_call", companyName: "UA Co" },
      admin,
      { ownerType: "admin", ownerUserId: admin.id! },
    );

    await assignLeadOwner(lead.id, agent.id, admin);
    expect((await pendingUndoFor(admin.id!))?.label).toBe(
      "Assigned Undo Assign Corp to Undo Agent",
    );

    await performUndo(admin);
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(admin.id);
    expect(fresh.ownerType).toBe("admin");
    expect(await listOwnLeads(agent.id)).toEqual([]);
  });

  it("refuses accounts that cannot own a lead, dead accounts, and archived leads", async () => {
    const admin = await makeAdmin();
    const otherAdmin = await makeUser("Second Admin", "bsystems_admin");
    const byteforce = await makeUser("BF Staff", "byteforce_staff");
    const inactive = await makeUser("Retired Agent", "bsystems_agent", { active: false });
    const pending = await makeUser("Pending Agent", "bsystems_agent", {
      registrationStatus: "pending",
    });
    const agent = await makeUser("Live Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Guarded Corp", number: "0107778889", type: "cold_call", companyName: "Guarded Co" },
      admin,
    );

    await expect(assignLeadOwner(lead.id, otherAdmin.id, admin)).rejects.toThrow(/agent, a partner/);
    await expect(assignLeadOwner(lead.id, byteforce.id, admin)).rejects.toThrow(/agent, a partner/);
    await expect(assignLeadOwner(lead.id, inactive.id, admin)).rejects.toThrow(/deactivated/);
    await expect(assignLeadOwner(lead.id, pending.id, admin)).rejects.toThrow(/awaiting approval/);
    await expect(assignLeadOwner(lead.id, "no-such-user", admin)).rejects.toThrow(/not found/);

    /* ADR-043: an archived lead is read-only until it comes back */
    await setArchived("bsystems", lead.id, true, admin);
    await expect(assignLeadOwner(lead.id, agent.id, admin)).rejects.toThrow(/Unarchive/);

    /* a ByteForce lead is not a B-Systems lead */
    const bf = await createLead(
      "byteforce",
      { name: "BF Corp", number: "0108889990", type: "cold_call" },
      admin,
    );
    await expect(assignLeadOwner(bf.id, agent.id, admin)).rejects.toThrow(/not found/);
  });

  it("the assignable list is live, approved agents / partners / internal sales — never admins", async () => {
    await makeAdmin();
    await makeUser("Listed Agent", "bsystems_agent");
    await makeUser("Listed Partner", "bsystems_partner");
    await makeUser("Listed Sales", "bsystems_sales");
    await makeUser("Dead Agent", "bsystems_agent", { active: false });
    await makeUser("Unapproved Agent", "bsystems_agent", { registrationStatus: "pending" });
    await makeUser("BF Only", "byteforce_staff");

    const owners = await listAssignableOwners();
    expect(owners.map((o) => o.name)).toEqual(["Listed Agent", "Listed Partner", "Listed Sales"]);
  });
});
