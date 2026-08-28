import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  applyLeadEvent,
  createLead,
  deleteLead,
  markReadyToClose,
  setArchived,
  setNoAnswer,
  updateLead,
} from "./leads";
import { listBsLeads, listOwnLeads } from "./bsystems-admin";
import { internalDashboard } from "./metrics";
import { todoFor } from "./todo";
import { cairoToUtc } from "@/lib/datetime";
import { applyProspectEvent, createPartnerLogin, createProspect } from "./partners";
import { checkMilestone, uncheckMilestone } from "./milestones";
import {
  createStatement,
  listStatements,
  markStatementPaid,
  paymentsFor,
  replaceStatementProof,
  waitingToBePaidOut,
} from "./statements";
import { storage } from "@/lib/storage";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "./won-leads";
import {
  approveRegistration,
  updateUser,
  mintImpersonationToken,
  rejectRegistration,
  verifyImpersonationToken,
} from "./users";
import { signupRep } from "./portal-reps";
import { wonDealSchema } from "./groups";
import { verifyPassword } from "@/lib/auth/hash";
import type { Actor } from "./activity";

/* REQUIREMENTS-V2 integration obligations: B-9 confirm-win → WonDeal+milestones,
   ready-to-close notification, the agent light flow (day-only follow-up, meeting
   request notification, form-free proposal return), commission visibility,
   statements end-to-end, PP-4 account provisioning, impersonation tokens. */

process.env.AUTH_SECRET ??= "vitest-secret";

const admin: Actor = { id: null, label: "Test Admin" };

const WON_TAB = {
  estimatedValue: 900_000_00,
  totalCommissionPercentBp: 10_00,
  contractDate: "2026-08-01",
  milestones: [
    { label: "Discovery", value: 300_000_00, commissionValue: 30_000_00, expectedEnd: "2026-09-01" },
    { label: "Build", value: 600_000_00, commissionValue: 60_000_00, expectedEnd: "2026-12-01" },
  ],
};

let agentSeq = 0;
async function makeAgent() {
  const user = await db.user.create({
    data: { name: "Karim Agent", phone: `+2010011122${20 + agentSeq++}`, passwordHash: "x" },
  });
  await db.userRole.create({ data: { userId: user.id, role: "bsystems_agent" } });
  return user;
}

function makeLead(opts?: { ownerType?: string; ownerUserId?: string }) {
  return createLead(
    "bsystems",
    { name: "Acme Corp", number: "0101234567", type: "personal_connection" },
    admin,
    opts ? { ownerType: opts.ownerType as never, ownerUserId: opts.ownerUserId } : undefined,
  );
}

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Confirm-win → milestone tab (V2 §4, trigger B-9)", () => {
  it("creates the WonDeal with ordered milestones and moves the lead to Won", async () => {
    const lead = await makeLead();
    const r = await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor: admin,
      role: "bsystems_admin",
    });
    expect(r.toStage).toBe("won");

    const won = await db.wonDeal.findUniqueOrThrow({
      where: { leadId: lead.id },
      include: { milestones: { orderBy: { index: "asc" } } },
    });
    expect(won.estimatedValue).toBe(900_000_00);
    expect(won.totalCommissionPercent).toBe(10_00); // percent stored as basis points
    expect(won.milestones.map((m) => m.label)).toEqual(["Discovery", "Build"]);
    expect(won.milestones[0]!.commissionValue).toBe(30_000_00);
    const log = await db.activityLog.findFirst({
      where: { entityType: "won_deal", entityId: won.id, trigger: "B-9" },
    });
    expect(log).toBeTruthy();
  });

  it("agents cannot set Won (server-side, not just hidden UI)", async () => {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    await expect(
      applyLeadEvent({
        brand: "bsystems",
        leadId: lead.id,
        event: { type: "next_action", action: "won" },
        group: { group: "won_deal", data: WON_TAB },
        actor: { id: agent.id, label: agent.name },
        role: "bsystems_agent",
      }),
    ).rejects.toThrow();
    expect(await db.wonDeal.count()).toBe(0);
  });

  it("deleting a WON lead cascades its whole financial trail (founder V4)", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor: admin,
      role: "bsystems_admin",
    });
    const won = await db.wonDeal.findUniqueOrThrow({
      where: { leadId: lead.id },
      include: { milestones: { orderBy: { index: "asc" } } },
    });
    await checkMilestone(won.milestones[0]!.id, admin);
    const waiting = await waitingToBePaidOut();
    await createStatement(
      {
        milestoneId: waiting[0]!.milestoneId,
        clientName: "Acme Corp",
        milestoneLabel: "Discovery",
        milestoneValue: 300_000_00,
        percentBp: 10_00,
        amount: 30_000_00,
        adjustments: 0,
      },
      admin,
    );

    await deleteLead("bsystems", lead.id, admin);
    expect(await db.lead.findUnique({ where: { id: lead.id } })).toBeNull();
    expect(await db.wonDeal.count()).toBe(0);
    expect(await db.milestone.count()).toBe(0);
    expect(await db.statement.count()).toBe(0);
  });
});

describe("Ready to close (V2 §3, trigger B-RTC)", () => {
  it("flags the card and broadcasts an admin notification with the lead link", async () => {
    const lead = await makeLead();
    await markReadyToClose("bsystems", lead.id, admin);
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.readyToClose).toBe(true);
    const note = await db.notification.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(note.type).toBe("ready_to_close");
    expect(note.userId).toBeNull(); // admin broadcast

    /* Idempotent: flagging again adds no second notification. */
    await markReadyToClose("bsystems", lead.id, admin);
    expect(await db.notification.count()).toBe(1);
  });
});

describe('"Didn\'t answer" flag (founder directive, ADR-039)', () => {
  it("toggles on/off, persists, logs both moves, and never touches the stage", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    let fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.noAnswer).toBe(true);
    expect(fresh.stage).toBe(lead.stage); // a marker, not a transition
    expect(await db.notification.count()).toBe(0); // no admin notification either

    await setNoAnswer("bsystems", lead.id, false, admin);
    fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.noAnswer).toBe(false);

    const logs = await db.activityLog.findMany({
      where: { entityId: lead.id, trigger: { in: ["no_answer", "no_answer_cleared"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.trigger)).toEqual(["no_answer", "no_answer_cleared"]);
    expect(logs.every((l) => l.fromStage === null && l.toStage === null)).toBe(true);

    /* Idempotent: clearing an already-clear flag writes no third row. */
    await setNoAnswer("bsystems", lead.id, false, admin);
    expect(
      await db.activityLog.count({
        where: { entityId: lead.id, trigger: { in: ["no_answer", "no_answer_cleared"] } },
      }),
    ).toBe(2);
  });

  it("auto-clears when the lead moves stages (any move = contact made)", async () => {
    const lead = await makeLead();
    await setNoAnswer("bsystems", lead.id, true, admin);
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-01", time: "10:00", method: "call" } },
      actor: admin,
      role: "bsystems_admin",
    });
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.stage).toBe("following_up");
    expect(fresh.noAnswer).toBe(false);
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer_cleared" } }),
    ).toBe(1);

    /* Moving an UNFLAGGED lead writes no cleared row. */
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-03", time: "14:00", mode: "online" },
      },
      actor: admin,
      role: "bsystems_admin",
    });
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe(
      "meeting_setting",
    );
    expect(
      await db.activityLog.count({ where: { entityId: lead.id, trigger: "no_answer_cleared" } }),
    ).toBe(1);
  });
});

describe("Archive (founder, ADR-043)", () => {
  it("archiving hides the lead from list, dashboard, and to-do; the Archived view and unarchive bring it back; both moves logged", async () => {
    const NOW = cairoToUtc("2026-08-20", "12:00");
    const lead = await makeLead();
    await db.lead.update({ where: { id: lead.id }, data: { stage: "following_up" } });
    await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2026-08-20", "10:00"),
        method: "call",
      },
    });

    /* visible everywhere before */
    expect((await listBsLeads("bsystems", "any")).map((l) => l.id)).toEqual([lead.id]);
    expect((await internalDashboard("bsystems")).totalLeads).toBe(1);
    expect(
      (await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW })).today,
    ).toHaveLength(1);

    await setArchived("bsystems", lead.id, true, admin);
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.archived).toBe(true);
    expect(fresh.archivedAt).not.toBeNull();

    /* hidden from every default surface — but present in the Archived view */
    expect(await listBsLeads("bsystems", "any")).toHaveLength(0);
    expect((await internalDashboard("bsystems")).totalLeads).toBe(0);
    expect(
      (await todoFor({ brand: "bsystems", scope: { kind: "all" }, now: NOW })).today,
    ).toHaveLength(0);
    expect((await listBsLeads("bsystems", "any", { archived: true })).map((l) => l.id)).toEqual([lead.id]);

    /* unarchive restores; no data was lost */
    await setArchived("bsystems", lead.id, false, admin);
    const restored = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(restored.archived).toBe(false);
    expect(restored.archivedAt).toBeNull();
    expect(restored.stage).toBe("following_up");
    expect((await listBsLeads("bsystems", "any")).map((l) => l.id)).toEqual([lead.id]);

    const logs = await db.activityLog.findMany({
      where: { entityId: lead.id, trigger: { in: ["archived", "unarchived"] } },
      orderBy: { createdAt: "asc" },
    });
    expect(logs.map((l) => l.trigger)).toEqual(["archived", "unarchived"]);
  });

  it("hardening: an archived lead is read-only — events, flags, and edits reject until unarchived", async () => {
    const lead = await makeLead();
    await setArchived("bsystems", lead.id, true, admin);

    const event = {
      brand: "bsystems" as const,
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" } as const,
      group: {
        group: "follow_up" as const,
        data: { date: "2026-09-01", time: "10:00", method: "call" as const },
      },
      actor: admin,
      role: "bsystems_admin" as const,
    };
    await expect(applyLeadEvent(event)).rejects.toThrow("Unarchive this lead first");
    await expect(markReadyToClose("bsystems", lead.id, admin)).rejects.toThrow(
      "Unarchive this lead first",
    );
    await expect(setNoAnswer("bsystems", lead.id, true, admin)).rejects.toThrow(
      "Unarchive this lead first",
    );
    await expect(updateLead("bsystems", lead.id, { name: "Renamed" }, admin)).rejects.toThrow(
      "Unarchive this lead first",
    );
    expect((await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).stage).toBe("new");

    /* unarchiving restores full operability */
    await setArchived("bsystems", lead.id, false, admin);
    const r = await applyLeadEvent(event);
    expect(r.toStage).toBe("following_up");
  });
});

describe("Agent light flow (V2 §3)", () => {
  it("accepts a day-only follow-up (defaults to 09:00 Cairo)", async () => {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    const r = await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-15", method: "call" } },
      actor: { id: agent.id, label: agent.name },
      role: "bsystems_agent",
    });
    expect(r.toStage).toBe("following_up");
    const fu = await db.followUp.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(fu.dueAt.toISOString()).toBe("2026-09-15T06:00:00.000Z"); // 09:00 Cairo (UTC+3)
  });

  it("an agent meeting request notifies the admins with the details", async () => {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: {
          arranged: true,
          date: "2026-09-20",
          time: "14:00",
          mode: "online",
          needsTechnical: true,
        },
      },
      actor: { id: agent.id, label: agent.name },
      role: "bsystems_agent",
    });
    const note = await db.notification.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(note.type).toBe("meeting_request");
    expect(note.userId).toBeNull();
    expect(note.body).toContain("2026-09-20 14:00");
    expect(note.body).toContain("technical colleague: yes");
  });

  it("B-4: an agent's proposal-sent auto-returns WITHOUT a follow-up form", async () => {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "sending_proposal" },
      group: { group: "proposal", data: { service: "ERP rollout", sent: false } },
      actor: { id: agent.id, label: agent.name },
      role: "bsystems_agent",
    });
    const r = await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "proposal_sent" },
      actor: { id: agent.id, label: agent.name },
      role: "bsystems_agent",
    });
    expect(r.toStage).toBe("following_up");
    expect(await db.followUp.count({ where: { leadId: lead.id } })).toBe(0); // no form demanded
    const proposal = await db.proposal.findFirstOrThrow({ where: { leadId: lead.id } });
    expect(proposal.sent).toBe(true);
  });
});

describe("Won-lead commission visibility (V2 §4)", () => {
  it("closers see commission; internal sales never does; admin sees everything", async () => {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor: admin,
      role: "bsystems_admin",
    });

    const forAdmin = await adminWonLeads("bsystems");
    expect(forAdmin[0]!.milestones[0]!.commissionValue).toBe(30_000_00);

    const forCloser = await closerWonLeads("bsystems", agent.id, { showCommission: true });
    expect(forCloser).toHaveLength(1);
    expect(forCloser[0]!.totalCommissionPercent).toBe(10_00);
    expect(forCloser[0]!.milestones[0]!.commissionValue).toBe(30_000_00); // M1 unlocked
    expect(forCloser[0]!.milestones[1]!.commissionValue).toBeNull(); // M2 locked

    const forSales = await salesWonLeads("bsystems");
    expect(forSales.every((w) => w.totalCommissionPercent === null)).toBe(true);
  });
});

describe("Statements end-to-end (V2 §7)", () => {
  async function wonWithCheckedM1() {
    const agent = await makeAgent();
    const lead = await makeLead({ ownerType: "agent", ownerUserId: agent.id });
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor: admin,
      role: "bsystems_admin",
    });
    const won = await db.wonDeal.findUniqueOrThrow({
      where: { leadId: lead.id },
      include: { milestones: { orderBy: { index: "asc" } } },
    });
    await checkMilestone(won.milestones[0]!.id, admin);
    return { agent, lead, won };
  }

  it("checked milestone → waiting list → coded statement → closer's pending payment → paid with proof", async () => {
    const { agent, won } = await wonWithCheckedM1();

    /* Sequential rule: with M1 checked, M2 unlocks; uncheck M2 to keep only M1. */
    await checkMilestone(won.milestones[1]!.id, admin);
    expect(
      (await db.milestone.findUniqueOrThrow({ where: { id: won.milestones[1]!.id } })).completed,
    ).toBe(true);
    await uncheckMilestone(won.milestones[1]!.id, admin);

    const waiting = await waitingToBePaidOut();
    expect(waiting).toHaveLength(1);
    expect(waiting[0]!.label).toBe("Discovery");
    expect(waiting[0]!.closerUserId).toBe(agent.id);
    expect(waiting[0]!.commissionValue).toBe(30_000_00);

    const statement = await createStatement(
      {
        milestoneId: waiting[0]!.milestoneId,
        clientName: "Acme Corp",
        milestoneLabel: "Discovery",
        milestoneValue: 300_000_00,
        percentBp: 10_00,
        amount: 30_000_00,
        adjustments: -1_000_00,
        expectedDate: "2026-10-01",
      },
      admin,
    );
    expect(statement.code).toBe("ST-0001");
    expect(statement.status).toBe("pending");
    expect(statement.closerUserId).toBe(agent.id);

    /* The milestone leaves the waiting list; a second statement is refused. */
    expect(await waitingToBePaidOut()).toHaveLength(0);
    await expect(
      createStatement(
        {
          milestoneId: waiting[0]!.milestoneId,
          clientName: "Acme Corp",
          milestoneLabel: "Discovery",
          milestoneValue: 300_000_00,
          percentBp: 10_00,
          amount: 30_000_00,
          adjustments: 0,
        },
        admin,
      ),
    ).rejects.toThrow(/already exists/);

    /* Closer sees it pending. */
    const pending = await paymentsFor(agent.id);
    expect(pending).toHaveLength(1);
    expect(pending[0]!.status).toBe("pending");

    /* Mark paid with a proof IMAGE (magic-sniffed). */
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(256, 3),
    ]);
    const paid = await markStatementPaid(statement.id, new File([png], "proof.png"), admin);
    expect(paid.status).toBe("paid");
    const proof = await db.attachment.findFirstOrThrow({ where: { statementId: statement.id } });
    expect(proof.kind).toBe("payment_proof");

    /* A PDF is NOT a proof image. */
    const { won: won2 } = await (async () => {
      const again = await wonWithCheckedM1();
      return again;
    })();
    const waiting2 = await waitingToBePaidOut();
    const st2 = await createStatement(
      {
        milestoneId: waiting2[0]!.milestoneId,
        clientName: "Acme Corp",
        milestoneLabel: "Discovery",
        milestoneValue: 300_000_00,
        percentBp: 10_00,
        amount: 30_000_00,
        adjustments: 0,
      },
      admin,
    );
    await expect(
      markStatementPaid(st2.id, new File([Buffer.from("%PDF-1.7")], "proof.pdf"), admin),
    ).rejects.toThrow();
    expect(won2.id).toBeTruthy();
  });

  it("lost proof file: listStatements flags it; replaceStatementProof restores it (paid only)", async () => {
    const { won } = await wonWithCheckedM1();
    const waiting = await waitingToBePaidOut();
    const statement = await createStatement(
      {
        milestoneId: waiting[0]!.milestoneId,
        clientName: "Acme Corp",
        milestoneLabel: "Discovery",
        milestoneValue: 300_000_00,
        percentBp: 10_00,
        amount: 30_000_00,
        adjustments: 0,
      },
      admin,
    );

    /* Not paid yet → replace is refused. */
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.alloc(256, 3),
    ]);
    await expect(
      replaceStatementProof(statement.id, new File([png], "early.png"), admin),
    ).rejects.toThrow(/not paid yet/);

    await markStatementPaid(statement.id, new File([png], "proof.png"), admin);
    let listed = (await listStatements()).find((s) => s.id === statement.id)!;
    expect(listed.proofs[0]!.fileOk).toBe(true);

    /* Simulate the redeploy wipe: the row survives, the file does not. */
    const oldKey = listed.proofs[0]!.storageKey;
    await storage.delete(oldKey);
    listed = (await listStatements()).find((s) => s.id === statement.id)!;
    expect(listed.proofs[0]!.fileOk).toBe(false);

    /* Re-upload: one fresh attachment, present in storage, statement stays paid. */
    const replaced = await replaceStatementProof(
      statement.id,
      new File([png], "proof-restored.png"),
      admin,
    );
    expect(replaced.status).toBe("paid");
    const proofs = await db.attachment.findMany({ where: { statementId: statement.id } });
    expect(proofs).toHaveLength(1);
    expect(proofs[0]!.filename).toBe("proof-restored.png");
    expect(proofs[0]!.storageKey).not.toBe(oldKey);
    expect(await storage.size(proofs[0]!.storageKey)).toBeGreaterThan(0);
    listed = (await listStatements()).find((s) => s.id === statement.id)!;
    expect(listed.proofs[0]!.fileOk).toBe(true);
    const log = await db.activityLog.findFirst({
      where: { entityType: "statement", entityId: statement.id, trigger: "proof_replaced" },
    });
    expect(log).toBeTruthy();
    expect(won.id).toBeTruthy();
  });
});

describe("PP-4a partner account provisioning (founder: admin sets the credentials)", () => {
  const GATE = {
    companyName: "Mansour Trading",
    keyPersonName: "Hany Mansour",
    keyPersonRole: "CEO",
    address: "45 Nile Corniche, Cairo",
    number: "0223456789",
    businessActivity: "Import/export",
    importance: "high" as const,
  };

  function makeProspect() {
    return createProspect(
      {
        kind: "partner" as const,
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      admin,
    );
  }

  it("the login is created by the SEPARATE action, with EXACTLY those credentials", async () => {
    const p = await makeProspect();
    /* ADR-059 — founder 1.3: the Qualified gate asks for no credentials at all,
       so the card converts first and the login is its own explicit step. */
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: { ...GATE, email: "hany@mansour.example" } },
      actor: admin,
      role: "bsystems_admin",
    });
    expect((await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } })).userId).toBeNull();

    await createPartnerLogin(
      p.id,
      { email: "hany@mansour.example", password: "Mansour#2026" },
      admin,
    );
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.userId).toBeTruthy();
    const user = await db.user.findUniqueOrThrow({
      where: { id: partner.userId! },
      include: { roles: true },
    });
    expect(user.email).toBe("hany@mansour.example");
    expect(user.roles.map((r) => r.role)).toEqual(["bsystems_partner"]);
    expect(await verifyPassword("Mansour#2026", user.passwordHash)).toBe(true);
    /* founder V4: the admin sees the password in Users */
    expect(user.passwordPlain).toBe("Mansour#2026");
  });

  it("an email WITHOUT a password now converts happily — the old refine is gone", async () => {
    /* founder 1.3, stated as a regression: the gate used to demand a password
       the moment an email was typed. It must never do that again. */
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: { ...GATE, email: "hany@mansour.example" } },
      actor: admin,
      role: "bsystems_admin",
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.email).toBe("hany@mansour.example");
    expect(partner.userId).toBeNull();
    expect(await db.user.count({ where: { email: "hany@mansour.example" } })).toBe(0);
  });

  it("no email at all still converts the partner without a login (unchanged)", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: GATE },
      actor: admin,
      role: "bsystems_admin",
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.userId).toBeNull();
  });
});

describe("Impersonation tokens (V2 §2.10 + founder snap-back)", () => {
  it("carries the impersonating admin, logs, and rejects tampering/expiry", async () => {
    const agent = await makeAgent();
    const token = await mintImpersonationToken(agent.id, admin, {
      impersonatorId: "admin-user-1",
    });
    /* the session remembers WHO impersonates — powers "Back to admin" */
    expect(verifyImpersonationToken(token)).toEqual({
      userId: agent.id,
      impersonatorId: "admin-user-1",
    });

    /* the snap-back token has NO impersonator — a clean admin session */
    const returnToken = await mintImpersonationToken(agent.id, admin, {
      trigger: "impersonation_return",
    });
    expect(verifyImpersonationToken(returnToken)).toEqual({
      userId: agent.id,
      impersonatorId: null,
    });
    expect(
      await db.activityLog.count({
        where: { entityId: agent.id, trigger: "impersonation_return" },
      }),
    ).toBe(1);

    const log = await db.activityLog.findFirst({
      where: { entityType: "user", entityId: agent.id, trigger: "impersonation" },
    });
    expect(log).toBeTruthy();

    /* Tampered target → invalid. */
    const [, imp, expiry, sig] = token.split(".");
    expect(verifyImpersonationToken(`someone-else.${imp}.${expiry}.${sig}`)).toBeNull();

    /* Expired → invalid. */
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 61_000);
    expect(verifyImpersonationToken(token)).toBeNull();
  });

  it("refuses to impersonate a deactivated account", async () => {
    const agent = await makeAgent();
    await db.user.update({ where: { id: agent.id }, data: { active: false } });
    await expect(mintImpersonationToken(agent.id, admin)).rejects.toThrow(/deactivated/);
  });
});

describe("Registration approval cycle (founder V3)", () => {
  const PDF = Buffer.concat([Buffer.from("%PDF-1.7 reg"), Buffer.alloc(256, 9)]);

  function makeSignup() {
    return signupRep(
      {
        firstName: "Nour",
        lastName: "Pending",
        phone: "01055556666",
        email: "Nour@Agents.Example",
        address: "1 Approval St",
        speciality: "Field sales",
        password: "nour12345",
        confirmPassword: "nour12345",
      },
      new File([PDF], "cv.pdf", { type: "application/pdf" }),
    );
  }

  it("signup lands PENDING with both identifiers + an admin notification", async () => {
    const { userId } = await makeSignup();
    const user = await db.user.findUniqueOrThrow({
      where: { id: userId },
      include: { roles: true, portalRep: true },
    });
    expect(user.registrationStatus).toBe("pending");
    expect(user.email).toBe("nour@agents.example"); // lowercased — email sign-in works
    expect(user.phone).toBeTruthy(); // phone sign-in works too
    expect(user.roles.map((r) => r.role)).toEqual(["bsystems_agent"]);
    expect(user.portalRep).toBeTruthy();
    const note = await db.notification.findFirstOrThrow({ where: { type: "registration" } });
    expect(note.userId).toBeNull(); // admin broadcast
    expect(note.title).toContain("Nour Pending");
  });

  it("approve activates the account; reject locks it; approved accounts can't be rejected", async () => {
    const { userId } = await makeSignup();
    await approveRegistration(userId, admin);
    const approved = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(approved.registrationStatus).toBe("approved");
    expect(approved.active).toBe(true);
    await expect(rejectRegistration(userId, admin)).rejects.toThrow(/already approved/);

    const second = await signupRep(
      {
        firstName: "Rana",
        lastName: "Declined",
        phone: "01077778888",
        email: "rana@agents.example",
        address: "2 Reject Rd",
        speciality: "Retail",
        password: "rana12345",
        confirmPassword: "rana12345",
      },
      new File([PDF], "cv2.pdf", { type: "application/pdf" }),
    );
    await rejectRegistration(second.userId, admin);
    const rejected = await db.user.findUniqueOrThrow({ where: { id: second.userId } });
    expect(rejected.registrationStatus).toBe("rejected");
    expect(rejected.active).toBe(false);
  });
});

describe("Admin user editing (founder V4)", () => {
  it("edits identity/identifiers/roles/password; the password becomes visible", async () => {
    const agent = await makeAgent();
    await updateUser(
      agent.id,
      {
        name: "Karim Renamed",
        email: "karim@agents.example",
        password: "NewPass#2026",
        roles: ["bsystems_agent", "bsystems_partner"],
      },
      admin,
    );
    const updated = await db.user.findUniqueOrThrow({
      where: { id: agent.id },
      include: { roles: true },
    });
    expect(updated.name).toBe("Karim Renamed");
    expect(updated.email).toBe("karim@agents.example");
    expect(updated.roles.map((r) => r.role).sort()).toEqual([
      "bsystems_agent",
      "bsystems_partner",
    ]);
    expect(await verifyPassword("NewPass#2026", updated.passwordHash)).toBe(true);
    expect(updated.passwordPlain).toBe("NewPass#2026");
  });

  it("refuses identifier collisions and self-demotion", async () => {
    const a = await makeAgent();
    const b = await makeAgent();
    await updateUser(a.id, { email: "taken@agents.example" }, admin);
    await expect(
      updateUser(b.id, { email: "taken@agents.example" }, admin),
    ).rejects.toThrow(/another account/);

    const adminUser = await db.user.create({
      data: { name: "Boss", email: "boss@x.example", passwordHash: "h" },
    });
    await db.userRole.create({ data: { userId: adminUser.id, role: "bsystems_admin" } });
    await expect(
      updateUser(
        adminUser.id,
        { roles: ["bsystems_sales"] },
        { id: adminUser.id, label: "Boss" },
      ),
    ).rejects.toThrow(/your own admin access/);
  });
});

describe("Universal lead search (founder: one box — name, company, or number)", () => {
  async function searchFixtures() {
    const a = await createLead(
      "bsystems",
      {
        name: "Delta Textiles",
        number: "0101234567",
        type: "cold_call",
        companyName: "Nile Trading",
      },
      admin,
    );
    const b = await createLead(
      "bsystems",
      {
        name: "Karim Hassan",
        number: "0223339999",
        type: "personal_connection",
        companyName: "Delta Foods",
      },
      admin,
    );
    const c = await createLead(
      "bsystems",
      { name: "Unrelated Contact", number: "0501112222", type: "event_data" },
      admin,
    );
    return { a, b, c };
  }

  const ids = (leads: Array<{ id: string }>) => leads.map((l) => l.id).sort();

  it("matches the lead NAME, case-insensitively and on a partial", async () => {
    const { a } = await searchFixtures();
    expect(ids(await listBsLeads("bsystems", "any", { search: "textil" }))).toEqual([a.id]);
    expect(ids(await listBsLeads("bsystems", "any", { search: "TEXTILES" }))).toEqual([a.id]);
  });

  it("matches the COMPANY name (and one query may hit a name here, a company there)", async () => {
    const { a, b } = await searchFixtures();
    expect(ids(await listBsLeads("bsystems", "any", { search: "nile tra" }))).toEqual([a.id]);
    /* "delta" is A's NAME and B's COMPANY — both come back */
    expect(ids(await listBsLeads("bsystems", "any", { search: "delta" }))).toEqual([a.id, b.id].sort());
  });

  it("matches the NUMBER on a partial", async () => {
    const { b } = await searchFixtures();
    expect(ids(await listBsLeads("bsystems", "any", { search: "0223339" }))).toEqual([b.id]);
  });

  it("matches a SPACED digits query against the stored number (\"010 123\" → 0101234567)", async () => {
    const { a } = await searchFixtures();
    expect(ids(await listBsLeads("bsystems", "any", { search: "010 123" }))).toEqual([a.id]);
    expect(ids(await listBsLeads("bsystems", "any", { search: "010-1234-567" }))).toEqual([a.id]);
  });

  it("matches ARABIC names — the platform is bilingual, so the database must be UTF8", async () => {
    const arabic = await createLead(
      "bsystems",
      {
        name: "دلتا للأغذية",
        number: "0102223333",
        type: "cold_call",
        companyName: "شركة النيل",
      },
      admin,
    );
    expect(ids(await listBsLeads("bsystems", "any", { search: "للأغذية" }))).toEqual([arabic.id]);
    expect(ids(await listBsLeads("bsystems", "any", { search: "النيل" }))).toEqual([arabic.id]);
  });

  it("narrows by lead TYPE server-side, and combines type + search (board filters)", async () => {
    const { a, b } = await searchFixtures();
    expect(ids(await listBsLeads("bsystems", "any", { type: "cold_call" }))).toEqual([a.id]);
    expect(ids(await listBsLeads("bsystems", "any", { type: "personal_connection" }))).toEqual([b.id]);
    expect(await listBsLeads("bsystems", "any", { type: "organic" })).toHaveLength(0);
    expect(ids(await listBsLeads("bsystems", "any", { type: "cold_call", search: "delta" }))).toEqual([a.id]);
    expect(await listBsLeads("bsystems", "any", { type: "cold_call", search: "karim" })).toHaveLength(0);
    /* "any" (and undefined) mean no narrowing at all */
    expect(await listBsLeads("bsystems", "any", { type: "any" })).toHaveLength(3);
  });

  it("an agent's OWN board takes the same search + type narrowing (listOwnLeads)", async () => {
    const agent = await makeAgent();
    const mine = await createLead(
      "bsystems",
      {
        name: "Agent Own Lead",
        number: "0104445555",
        type: "organic",
        companyName: "Own Co",
      },
      admin,
      { ownerType: "agent", ownerUserId: agent.id },
    );
    await createLead(
      "bsystems",
      { name: "Someone Else", number: "0106667777", type: "cold_call" },
      admin,
    );
    expect(ids(await listOwnLeads("bsystems", agent.id))).toEqual([mine.id]); // scope unchanged
    expect(ids(await listOwnLeads("bsystems", agent.id, { search: "own co" }))).toEqual([mine.id]);
    expect(ids(await listOwnLeads("bsystems", agent.id, { type: "organic" }))).toEqual([mine.id]);
    expect(await listOwnLeads("bsystems", agent.id, { type: "cold_call" })).toHaveLength(0);
    /* the other owner's lead never leaks in, whatever the query says */
    expect(await listOwnLeads("bsystems", agent.id, { search: "Someone Else" })).toHaveLength(0);
  });

  it("returns nothing when nothing matches, and still honours the other filters", async () => {
    const { a } = await searchFixtures();
    expect(await listBsLeads("bsystems", "any", { search: "zzqq" })).toHaveLength(0);
    /* combines with the owner bucket and the archive view */
    expect(await listBsLeads("bsystems", "agent", { search: "delta" })).toHaveLength(0);
    await setArchived("bsystems", a.id, true, admin);
    expect(await listBsLeads("bsystems", "any", { search: "textil" })).toHaveLength(0);
    expect(ids(await listBsLeads("bsystems", "any", { search: "textil", archived: true }))).toEqual([a.id]);
  });
});

describe("Won-deal math barriers (founder V3)", () => {
  const base = {
    estimatedValue: 100_000_00,
    totalCommissionPercentBp: 10_00,
    milestones: [
      { label: "A", value: 60_000_00, commissionValue: 6_000_00, expectedStart: "2026-09-01", expectedEnd: "2026-09-30" },
      { label: "B", value: 40_000_00, commissionValue: 4_000_00, expectedStart: "2026-10-01", expectedEnd: "2026-10-31" },
    ],
  };

  it("accepts coherent numbers and chronological milestones", () => {
    expect(wonDealSchema.safeParse(base).success).toBe(true);
  });

  it("refuses milestone values that don't add up to the estimated value", () => {
    const bad = { ...base, milestones: [{ ...base.milestones[0]! }, { ...base.milestones[1]!, value: 50_000_00 }] };
    const r = wonDealSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/must match/);
  });

  it("refuses commissions that don't match the total commission %", () => {
    const bad = { ...base, milestones: [{ ...base.milestones[0]!, commissionValue: 9_000_00 }, { ...base.milestones[1]! }] };
    const r = wonDealSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/commission/i);
  });

  it("refuses milestone 2 starting before milestone 1 finishes", () => {
    const bad = {
      ...base,
      milestones: [
        { ...base.milestones[0]! },
        { ...base.milestones[1]!, expectedStart: "2026-09-15" },
      ],
    };
    const r = wonDealSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/chronological/);
  });

  it("refuses a milestone that ends before it starts", () => {
    const bad = {
      ...base,
      milestones: [
        { ...base.milestones[0]!, expectedEnd: "2026-08-01" },
        { ...base.milestones[1]! },
      ],
    };
    const r = wonDealSchema.safeParse(bad);
    expect(r.success).toBe(false);
    expect(r.error!.issues[0]!.message).toMatch(/ends before it starts/);
  });
});
