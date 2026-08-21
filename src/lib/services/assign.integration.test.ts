import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { assignLeadOwner, createLead, setArchived } from "./leads";
import { applyProspectEvent, createAgentAccount, createProspect } from "./partners";
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

  /* Founder (To-Do) — "I can assign these to do as an admin or just take it
     myself." The admin is a legal target: the lead lands in the ADMIN bucket
     with them as its owner, which is exactly the state an admin-CREATED lead
     already has. The roster still excludes admins (see the last test) — taking
     it yourself is the only admin path, and it must not ping your own bell. */
  it("an admin can take the lead themselves: admin bucket, no self-notification, still undoable", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Handing Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Taken Corp", number: "0109990001", type: "cold_call", companyName: "Taken Co" },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );

    await assignLeadOwner(lead.id, admin.id!, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(admin.id);
    expect(fresh.ownerType).toBe("admin");
    expect(await listOwnLeads(agent.id)).toEqual([]);
    expect((await listBsLeads("admin")).map((l) => l.id)).toEqual([lead.id]);

    /* no bell for yourself — the log and the undo entry still record the move */
    expect(
      await db.notification.findMany({ where: { userId: admin.id!, type: "assigned" } }),
    ).toHaveLength(0);
    const log = await db.activityLog.findFirst({
      where: { entityId: lead.id, trigger: "assigned" },
    });
    expect(log).not.toBeNull();
    expect(log!.actorLabel).toBe("Assigning Admin");

    /* undo hands it straight back to the previous owner and bucket */
    expect((await pendingUndoFor(admin.id!))?.label).toBe("Assigned Taken Corp to Assigning Admin");
    await performUndo(admin);
    const back = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(back.ownerUserId).toBe(agent.id);
    expect(back.ownerType).toBe("agent");
    expect((await listOwnLeads(agent.id)).map((l) => l.id)).toEqual([lead.id]);
  });

  it("handing a lead to ANOTHER admin lands in the admin bucket and does ring their bell", async () => {
    const admin = await makeAdmin();
    const otherAdmin = await makeUser("Second Admin", "bsystems_admin");
    const lead = await createLead(
      "bsystems",
      { name: "Colleague Corp", number: "0109990002", type: "cold_call" },
      admin,
    );

    await assignLeadOwner(lead.id, otherAdmin.id, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(otherAdmin.id);
    expect(fresh.ownerType).toBe("admin");
    const notes = await db.notification.findMany({ where: { userId: otherAdmin.id } });
    expect(notes).toHaveLength(1);
    expect(notes[0]!.leadId).toBe(lead.id);
  });

  /* Review — role precedence: an account can hold bsystems_admin AND a second
     B-Systems role (the Users editor is a checkbox per role), and bsRoleOf /
     bucketFor already treat such an account as an ADMIN everywhere. Taking a
     lead must follow the same precedence: parking it in the shared internal
     bucket would push the admin's own task onto every internal-sales board and
     To-Do. */
  it("an admin who also holds a sales role still lands in the ADMIN bucket, not the shared internal one", async () => {
    const admin = await makeAdmin();
    const founder = await db.user.create({
      data: {
        name: "Founder Both Hats",
        phone: "+201066600900",
        passwordHash: "x",
        roles: { create: [{ role: "bsystems_admin" }, { role: "bsystems_sales" }] },
      },
    });
    const agent = await makeUser("Hybrid Handing Agent", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Hybrid Corp", number: "0109990003", type: "cold_call" },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );

    await assignLeadOwner(lead.id, founder.id, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerType).toBe("admin");
    expect(fresh.ownerUserId).toBe(founder.id);
    expect((await listBsLeads("internal")).map((l) => l.id)).toEqual([]);
    /* and it does NOT show up on the internal sales team's To-Do */
    const salesTodo = await todoFor({ brand: "bsystems", scope: { kind: "internal" } });
    expect([...salesTodo.today, ...salesTodo.overdue].map((i) => i.title)).not.toContain(
      "Hybrid Corp",
    );
  });

  it("refuses accounts that cannot own a lead, dead accounts, and archived leads", async () => {
    const admin = await makeAdmin();
    /* data entry "will not be the owner of what they add" (ADR-051), and a
       ByteForce login has no B-Systems bucket at all */
    const dataEntry = await makeUser("Entry Only", "bsystems_data_entry");
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

    await expect(assignLeadOwner(lead.id, dataEntry.id, admin)).rejects.toThrow(/agent, a partner/);
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

/* ---------------------------------------------------------------------------
   Founder, second sentence: "...and I can assing leads for agents also". The
   assign machinery already existed — what nothing proved was that an account
   minted by the QUALIFIED gate (ADR-057 / PA-4) walks straight into it, with no
   manual User or UserRole insert anywhere in the setup.
   --------------------------------------------------------------------------- */
describe("An agent minted by the account action is assignable the moment he exists", () => {
  it("appears in the roster, takes a lead, and sees it on his board and his To-Do", async () => {
    const admin = await makeAdmin();

    /* nobody is assignable yet */
    expect(await listAssignableOwners()).toEqual([]);

    /* the founder's flow, through the real services: a card, Qualified (which
       ADR-059 made a free move), then the SEPARATE account action */
    const card = await createProspect(
      {
        kind: "agent" as const,
        name: "Mounir Fahmy",
        number: "01033322211",
        email: "mounir.fahmy@example.com",
      },
      admin,
    );
    await applyProspectEvent({
      prospectId: card.id,
      event: { type: "next_action", action: "qualified" },
      actor: admin,
      role: "bsystems_admin",
    });
    /* qualifying alone mints nothing — he is not assignable yet */
    expect(await listAssignableOwners()).toEqual([]);
    await createAgentAccount(
      card.id,
      {
        firstName: "Mounir",
        lastName: "Fahmy",
        address: "44 Gameat El Dowal, Giza",
        speciality: "Cloud migration",
        email: "mounir.fahmy@example.com",
        password: "mounirpass123",
        phone: "01033322211",
      },
      admin,
    );

    const minted = await db.user.findUniqueOrThrow({
      where: { email: "mounir.fahmy@example.com" },
      include: { roles: true },
    });
    expect(minted.roles.map((r) => r.role)).toEqual(["bsystems_agent"]);
    expect(
      (await db.partnerProspect.findUniqueOrThrow({ where: { id: card.id } })).agentUserId,
    ).toBe(minted.id);

    /* (a) the roster — no extra approval step, no seeding */
    const owners = await listAssignableOwners();
    expect(owners.map((o) => o.name)).toEqual(["Mounir Fahmy"]);
    expect(owners[0]!.roles).toEqual(["bsystems_agent"]);

    /* (b) he can be handed a lead */
    const lead = await createLead(
      "bsystems",
      { name: "Qualified Gate Corp", number: "0102223334", type: "cold_call", companyName: "QG Co" },
      admin,
    );
    await db.lead.update({ where: { id: lead.id }, data: { stage: "following_up" } });
    const now = new Date("2026-08-20T09:00:00.000Z");
    await db.followUp.create({
      data: { leadId: lead.id, context: "initial", dueAt: now, method: "call" },
    });

    await assignLeadOwner(lead.id, minted.id, admin);
    const assigned = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(assigned.ownerUserId).toBe(minted.id);
    expect(assigned.ownerType).toBe("agent");
    expect(assigned.partnerId).toBeNull(); // ADR-047: attribution never moves with ownership

    /* (c) his own board, and (d) his own To-Do */
    expect((await listOwnLeads(minted.id)).map((l) => l.name)).toEqual(["Qualified Gate Corp"]);
    const mine = await todoFor({
      brand: "bsystems",
      scope: { kind: "own", userId: minted.id },
      now,
    });
    expect(mine.today.map((i) => i.title)).toEqual(["Qualified Gate Corp"]);

    /* (e) he was told */
    expect(await db.notification.count({ where: { userId: minted.id } })).toBe(1);
  });
});
