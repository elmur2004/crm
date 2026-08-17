import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead, applyLeadEvent, assignLeadOwner } from "./leads";
import { createProspect, applyProspectEvent } from "./partners";
import { assertCanCorrect, listMyEntries, notifyAdminsOfEntry } from "./data-entry";
import { listBsLeads } from "./bsystems-admin";
import { createUser, listAssignableOwners } from "./users";
import { bucketFor } from "@/lib/api/bsystems";
import type { RoleBearer } from "@/lib/auth/roles";
import type { Actor } from "./activity";

/* ADR-051 — the data-entry role. Founder: "This user is just able to add leads
   or partners or agents... They are just adding, and they will not be the owner
   of what they add. It will be with no owner until the admin decides which
   owner is these leads." */

const admin: Actor = { id: null, label: "Elmur" };

async function makeEntryUser(email = "entry@example.com") {
  const user = await createUser(
    { name: "Hala Nabil", email, password: "entry12345", roles: ["bsystems_data_entry"] },
    admin,
  );
  return user;
}

function asCurrentUser(user: { id: string; name: string }, roles: string[]): RoleBearer {
  return { id: user.id, name: user.name, roles: roles as RoleBearer["roles"] };
}

/** What the lead-create route does for a data-entry user. */
async function enterLead(entryUser: { id: string; name: string }, name: string) {
  const { ownerType, owned } = bucketFor("bsystems_data_entry");
  const lead = await createLead(
    "bsystems",
    { name, number: "0101234567", type: "cold_call", companyName: "Nile Foods" },
    { id: entryUser.id, label: entryUser.name },
    { ownerType, ownerUserId: owned ? entryUser.id : undefined },
  );
  await notifyAdminsOfEntry({ leadId: lead.id, leadName: lead.name, by: entryUser.name });
  return lead;
}

beforeEach(async () => {
  await resetDb();
});

describe("Data entry adds, and owns nothing", () => {
  it("a lead they enter lands unassigned — no owner, no rep — and notifies the admins", async () => {
    const entry = await makeEntryUser();
    const lead = await enterLead(entry, "Nile Foods");

    /* the founder's rule, expressed in the model that already meant it (A-6):
       internal bucket, no rep, no owner account */
    expect(lead.ownerType).toBe("internal");
    expect(lead.ownerUserId).toBeNull();
    expect(lead.salesRepId).toBeNull();
    expect(lead.stage).toBe("new");
    /* who TYPED it is recorded; that is never who OWNS it */
    expect(lead.createdByUserId).toBe(entry.id);

    const note = await db.notification.findFirstOrThrow({ where: { type: "needs_owner" } });
    expect(note.userId).toBeNull(); // broadcast to every admin
    expect(note.title).toContain("Hala Nabil");
    expect(note.title).toContain("needs an owner");
    expect(note.leadId).toBe(lead.id); // deep-links straight to it
  });

  it("the admin FINDS it under the Unassigned owner filter, then assigns it away", async () => {
    const entry = await makeEntryUser();
    const lead = await enterLead(entry, "Nile Foods");

    /* a lead with an owner must NOT show up in that queue — build one */
    const rep = await createUser(
      { name: "Karim Adel", phone: "01009998877", password: "agent12345", roles: ["bsystems_agent"] },
      admin,
    );
    const owned = await createLead(
      "bsystems",
      { name: "Owned Co", number: "0102223333", type: "cold_call" },
      admin,
      { ownerType: "agent", ownerUserId: rep.id },
    );

    const queue = await listBsLeads("unassigned");
    expect(queue.map((l) => l.id)).toEqual([lead.id]);
    expect(queue.map((l) => l.id)).not.toContain(owned.id);

    /* ADR-047's control is how it leaves the queue */
    await assignLeadOwner(lead.id, rep.id, admin);
    const assigned = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(assigned.ownerUserId).toBe(rep.id);
    expect(assigned.ownerType).toBe("agent");
    /* it leaves the queue, and the creator is still on record */
    expect(await listBsLeads("unassigned")).toHaveLength(0);
    expect(assigned.createdByUserId).toBe(entry.id);
  });

  it("a data-entry account is never offered as an owner", async () => {
    const entry = await makeEntryUser();
    await createUser(
      { name: "Karim Adel", phone: "01009998877", password: "agent12345", roles: ["bsystems_agent"] },
      admin,
    );
    const owners = await listAssignableOwners();
    expect(owners.map((o) => o.id)).not.toContain(entry.id);
    expect(owners.map((o) => o.name)).toContain("Karim Adel");
  });

  it("cards they add carry the creator and sit in the intake column", async () => {
    const entry = await makeEntryUser();
    const card = await createProspect(
      {
        kind: "partner" as const,
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      { id: entry.id, label: entry.name },
    );
    expect(card.createdByUserId).toBe(entry.id);
    expect(card.stage).toBe("lead");
  });
});

describe("Correcting an entry: only their own, only while untouched", () => {
  it("allows a correction until someone picks the lead up", async () => {
    const entry = await makeEntryUser();
    const me = asCurrentUser(entry, ["bsystems_data_entry"]);
    const lead = await enterLead(entry, "Nile Foods");

    await expect(assertCanCorrect(me, { kind: "lead", id: lead.id })).resolves.toBeUndefined();

    /* the moment it moves, it stops being theirs to edit */
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-20", time: "10:00", method: "call" } },
      actor: admin,
      role: "bsystems_admin",
    });
    await expect(assertCanCorrect(me, { kind: "lead", id: lead.id })).rejects.toThrow(
      /only correct an entry you added/,
    );
  });

  it("an OWNED lead is out of reach even in the intake stage", async () => {
    const entry = await makeEntryUser();
    const me = asCurrentUser(entry, ["bsystems_data_entry"]);
    const lead = await enterLead(entry, "Nile Foods");
    const rep = await createUser(
      { name: "Karim Adel", phone: "01009998877", password: "agent12345", roles: ["bsystems_agent"] },
      admin,
    );
    await assignLeadOwner(lead.id, rep.id, admin);
    await expect(assertCanCorrect(me, { kind: "lead", id: lead.id })).rejects.toThrow();
  });

  it("someone ELSE's entry is never correctable", async () => {
    const mine = await makeEntryUser("a@example.com");
    const theirs = await makeEntryUser("b@example.com");
    const lead = await enterLead(theirs, "Not Mine Co");
    await expect(
      assertCanCorrect(asCurrentUser(mine, ["bsystems_data_entry"]), { kind: "lead", id: lead.id }),
    ).rejects.toThrow();
  });

  it("a converted card is out of reach; an intake card is not", async () => {
    const entry = await makeEntryUser();
    const me = asCurrentUser(entry, ["bsystems_data_entry"]);
    const card = await createProspect(
      {
        kind: "partner" as const,
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      { id: entry.id, label: entry.name },
    );
    await expect(assertCanCorrect(me, { kind: "prospect", id: card.id })).resolves.toBeUndefined();

    await applyProspectEvent({
      prospectId: card.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won_partner",
        data: {
          companyName: "Mansour Trading",
          keyPersonName: "Hany Mansour",
          keyPersonRole: "CEO",
          address: "45 Nile Corniche, Cairo",
          number: "0223456789",
          businessActivity: "Import/export",
          importance: "high" as const,
        },
      },
      actor: admin,
      role: "bsystems_admin",
    });
    await expect(assertCanCorrect(me, { kind: "prospect", id: card.id })).rejects.toThrow();
  });

  it("the guard refuses anyone who is not a data-entry user", async () => {
    const entry = await makeEntryUser();
    const lead = await enterLead(entry, "Nile Foods");
    /* an admin does not go through this door — they have the real one */
    await expect(
      assertCanCorrect(asCurrentUser(entry, ["bsystems_admin", "bsystems_data_entry"]), {
        kind: "lead",
        id: lead.id,
      }),
    ).rejects.toThrow(/do not have access/);
  });
});

describe("Their own view", () => {
  it("lists exactly what they entered, with its correctable state", async () => {
    const entry = await makeEntryUser("a@example.com");
    const other = await makeEntryUser("b@example.com");
    const mine = await enterLead(entry, "Mine Co");
    await enterLead(other, "Theirs Co");
    const card = await createProspect(
      { kind: "agent" as const, name: "Nour Adel", number: "01099887766" },
      { id: entry.id, label: entry.name },
    );

    const view = await listMyEntries(entry.id);
    expect(view.leads.map((l) => l.name)).toEqual(["Mine Co"]); // never anyone else's
    expect(view.leads[0]!.editable).toBe(true);
    expect(view.prospects.map((p) => p.id)).toEqual([card.id]);
    expect(view.prospects[0]!.editable).toBe(true);

    await assignLeadOwner(mine.id, other.id, admin).catch(() => undefined);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: mine.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-20", time: "10:00", method: "call" } },
      actor: admin,
      role: "bsystems_admin",
    });
    const after = await listMyEntries(entry.id);
    expect(after.leads[0]!.editable).toBe(false); // read-only once it moved
  });
});
