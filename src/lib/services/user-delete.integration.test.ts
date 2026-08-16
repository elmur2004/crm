import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createLead, setNoAnswer } from "./leads";
import { deleteUser, setUserActive } from "./users";
import { pendingUndoFor } from "./undo";
import type { Actor } from "./activity";

/* Founder (ADR-049) — "give me the ability to completely delete a user, not
   just deactivate it." The policy: the LOGIN and the person's private
   artefacts are destroyed; every business record they touched is preserved.
   Each reference below is pinned to exactly where the ADR says it lands. */

let seq = 0;
async function makeUser(name: string, role: string) {
  return db.user.create({
    data: {
      name,
      phone: `+2010555000${seq++}`,
      passwordHash: "x",
      roles: { create: { role } },
    },
  });
}

async function makeAdmin(): Promise<Actor> {
  const user = await makeUser("Deleting Admin", "bsystems_admin");
  return { id: user.id, label: user.name };
}

beforeEach(async () => {
  await resetDb();
});

describe("Permanently deleting a user (ADR-049)", () => {
  it("destroys the login and its private artefacts, and lands every reference where the policy says", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Doomed Agent", "bsystems_agent");

    /* their agent profile + CV file */
    const rep = await db.portalRep.create({
      data: {
        userId: agent.id,
        firstName: "Doomed",
        lastName: "Agent",
        address: "1 Gone St",
        speciality: "Sales",
      },
    });
    const cv = await db.attachment.create({
      data: {
        kind: "cv",
        portalRepId: rep.id,
        filename: "cv.pdf",
        storageKey: "deadbeef.pdf",
        mime: "application/pdf",
        size: 12,
      },
    });

    /* their roles, a notification, an undo entry, and two owned leads */
    await db.notification.create({
      data: { userId: agent.id, type: "assigned", title: "t", body: "b" },
    });
    const leadA = await createLead(
      "bsystems",
      { name: "Kept Lead A", number: "0101110001", type: "cold_call", companyName: "Kept Co" },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    const leadB = await createLead(
      "bsystems",
      { name: "Kept Lead B", number: "0101110002", type: "cold_call", companyName: "Kept Co" },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    /* an undoable action of THEIR own — the pending inverse dies with them */
    await setNoAnswer("bsystems", leadA.id, true, { id: agent.id, label: agent.name });
    expect(await pendingUndoFor(agent.id)).not.toBeNull();

    /* a comment they wrote, and a follow-up they owned */
    await db.leadComment.create({
      data: {
        leadId: leadA.id,
        authorUserId: agent.id,
        authorLabel: "Doomed Agent",
        body: "I spoke to them",
      },
    });
    const followUp = await db.followUp.create({
      data: {
        leadId: leadA.id,
        context: "initial",
        dueAt: new Date(),
        method: "call",
        ownerPortalRepId: rep.id,
      },
    });

    /* a statement that paid them */
    const wonLead = await createLead(
      "bsystems",
      { name: "Won Lead", number: "0101110003", type: "cold_call", companyName: "Won Co" },
      admin,
    );
    const deal = await db.wonDeal.create({ data: { leadId: wonLead.id, estimatedValue: 1000 } });
    const milestone = await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, value: 1000 },
    });
    const statement = await db.statement.create({
      data: {
        code: "ST-7001",
        milestoneId: milestone.id,
        clientName: "Won Co",
        milestoneLabel: "M1",
        milestoneValue: 1000,
        percentBp: 1000,
        amount: 100,
        closerUserId: agent.id,
        closerLabel: "Doomed Agent",
      },
    });

    await deleteUser(agent.id, admin);

    /* the account, its roles, its profile and its notifications are gone */
    expect(await db.user.findUnique({ where: { id: agent.id } })).toBeNull();
    expect(await db.userRole.count({ where: { userId: agent.id } })).toBe(0);
    expect(await db.portalRep.findUnique({ where: { id: rep.id } })).toBeNull();
    expect(await db.attachment.findUnique({ where: { id: cv.id } })).toBeNull();
    expect(await db.notification.count({ where: { userId: agent.id } })).toBe(0);
    expect(await db.undoEntry.count({ where: { userId: agent.id } })).toBe(0);

    /* the LEADS survive, back in the admin bucket, each move recorded */
    for (const id of [leadA.id, leadB.id]) {
      const lead = await db.lead.findUniqueOrThrow({ where: { id } });
      expect(lead.ownerUserId).toBeNull();
      expect(lead.ownerType).toBe("admin");
      expect(
        await db.activityLog.count({ where: { entityId: id, trigger: "owner_deleted" } }),
      ).toBe(1);
    }

    /* the comment stays, unlinked but still attributed by label */
    const comment = await db.leadComment.findFirstOrThrow({ where: { leadId: leadA.id } });
    expect(comment.authorUserId).toBeNull();
    expect(comment.authorLabel).toBe("Doomed Agent");

    /* the follow-up survives its owner */
    const fresh = await db.followUp.findUniqueOrThrow({ where: { id: followUp.id } });
    expect(fresh.ownerPortalRepId).toBeNull();

    /* the money trail keeps the name and loses only the link */
    const fresherStatement = await db.statement.findUniqueOrThrow({ where: { id: statement.id } });
    expect(fresherStatement.closerUserId).toBeNull();
    expect(fresherStatement.closerLabel).toBe("Doomed Agent");

    /* history is history: their old rows keep their denormalised actor label */
    const theirLog = await db.activityLog.findFirst({
      where: { actorLabel: "Doomed Agent", trigger: "no_answer" },
    });
    expect(theirLog).not.toBeNull();
    /* and the deletion itself is on the record */
    expect(
      await db.activityLog.count({ where: { entityId: agent.id, trigger: "user_deleted" } }),
    ).toBe(1);
  });

  it("a partner COMPANY survives its login", async () => {
    const admin = await makeAdmin();
    const partnerUser = await makeUser("Partner Login", "bsystems_partner");
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Key Person",
        companyName: "Surviving LLC",
        number: "0223334445",
        businessActivity: "Consulting",
        stage: "won",
        converted: true,
      },
    });
    const partner = await db.partner.create({
      data: {
        prospectId: prospect.id,
        userId: partnerUser.id,
        companyName: "Surviving LLC",
        keyPersonName: "Key Person",
        keyPersonRole: "CEO",
        address: "1 Referral St",
        number: "0223334445",
        businessActivity: "Consulting",
        importance: "high",
      },
    });
    const referred = await createLead(
      "bsystems",
      { name: "Referred Lead", number: "0101110004", type: "cold_call", companyName: "Ref Co" },
      admin,
      { attribution: { partnerId: partner.id } },
    );

    await deleteUser(partnerUser.id, admin);

    const fresh = await db.partner.findUniqueOrThrow({ where: { id: partner.id } });
    expect(fresh.userId).toBeNull();
    expect(fresh.companyName).toBe("Surviving LLC");
    /* the referral attribution on the lead is untouched */
    expect((await db.lead.findUniqueOrThrow({ where: { id: referred.id } })).partnerId).toBe(
      partner.id,
    );
  });

  it("refuses to delete yourself and the bootstrap admin, and 404s on an unknown id", async () => {
    const admin = await makeAdmin();
    const bootstrap = await db.user.create({
      data: { name: "Elmur", email: "admin@byteforce.com", passwordHash: "x" },
    });

    await expect(deleteUser(admin.id!, admin)).rejects.toThrow(/your own account/);
    await expect(deleteUser(bootstrap.id, admin)).rejects.toThrow(/main admin account/);
    await expect(deleteUser("no-such-user", admin)).rejects.toThrow(/not found/);

    expect(await db.user.findUnique({ where: { id: admin.id! } })).not.toBeNull();
    expect(await db.user.findUnique({ where: { id: bootstrap.id } })).not.toBeNull();
  });

  it("is NOT undoable — it retires the acting admin's pending entries", async () => {
    const admin = await makeAdmin();
    const victim = await makeUser("Retire Test", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Retire Lead", number: "0101110005", type: "cold_call", companyName: "Retire Co" },
      admin,
    );
    await setNoAnswer("bsystems", lead.id, true, admin);
    expect(await pendingUndoFor(admin.id!)).not.toBeNull();

    await deleteUser(victim.id, admin);
    expect(await pendingUndoFor(admin.id!)).toBeNull();
  });

  it("deleting is distinct from deactivating: Remove leaves everything standing", async () => {
    const admin = await makeAdmin();
    const agent = await makeUser("Merely Removed", "bsystems_agent");
    const lead = await createLead(
      "bsystems",
      { name: "Still Theirs", number: "0101110006", type: "cold_call", companyName: "Still Co" },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );

    await setUserActive(agent.id, false, admin);

    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.ownerUserId).toBe(agent.id); // still theirs
    expect((await db.user.findUniqueOrThrow({ where: { id: agent.id } })).active).toBe(false);
  });
});
