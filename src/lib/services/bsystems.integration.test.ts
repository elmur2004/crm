import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { applyLeadEvent, createLead, deleteLead, markReadyToClose } from "./leads";
import { applyProspectEvent, createProspect } from "./partners";
import { checkMilestone, uncheckMilestone } from "./milestones";
import {
  createStatement,
  markStatementPaid,
  paymentsFor,
  waitingToBePaidOut,
} from "./statements";
import { adminWonLeads, closerWonLeads, salesWonLeads } from "./won-leads";
import { mintImpersonationToken, verifyImpersonationToken } from "./users";
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

  it("won leads cannot be deleted (they carry milestones)", async () => {
    const lead = await makeLead();
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_deal", data: WON_TAB },
      actor: admin,
      role: "bsystems_admin",
    });
    await expect(deleteLead("bsystems", lead.id, admin)).rejects.toThrow(/cannot be deleted/);
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

    const forAdmin = await adminWonLeads();
    expect(forAdmin[0]!.milestones[0]!.commissionValue).toBe(30_000_00);

    const forCloser = await closerWonLeads(agent.id, { showCommission: true });
    expect(forCloser).toHaveLength(1);
    expect(forCloser[0]!.totalCommissionPercent).toBe(10_00);
    expect(forCloser[0]!.milestones[0]!.commissionValue).toBe(30_000_00); // M1 unlocked
    expect(forCloser[0]!.milestones[1]!.commissionValue).toBeNull(); // M2 locked

    const forSales = await salesWonLeads();
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
});

describe("PP-4 partner account provisioning (V2 §8)", () => {
  it("conversion with an email creates the login with the auto password and links it", async () => {
    const p = await createProspect(
      {
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      admin,
    );
    await applyProspectEvent({
      prospectId: p.id,
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
          importance: "high",
          email: "hany@mansour.example",
        },
      },
      actor: admin,
      role: "bsystems_admin",
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.userId).toBeTruthy();
    const user = await db.user.findUniqueOrThrow({
      where: { id: partner.userId! },
      include: { roles: true },
    });
    expect(user.email).toBe("hany@mansour.example");
    expect(user.roles.map((r) => r.role)).toEqual(["bsystems_partner"]);
    /* V2 §8 — "{CompanyName}@Bsystemspartnership", spaces stripped. */
    expect(await verifyPassword("MansourTrading@Bsystemspartnership", user.passwordHash)).toBe(
      true,
    );
  });
});

describe("Impersonation tokens (V2 §2.10)", () => {
  it("mints a verifiable 60s token, logs it, and rejects tampering/expiry", async () => {
    const agent = await makeAgent();
    const token = await mintImpersonationToken(agent.id, admin);
    expect(verifyImpersonationToken(token)).toBe(agent.id);

    const log = await db.activityLog.findFirst({
      where: { entityType: "user", entityId: agent.id, trigger: "impersonation" },
    });
    expect(log).toBeTruthy();

    /* Tampered target → invalid. */
    const [, expiry, sig] = token.split(".");
    expect(verifyImpersonationToken(`someone-else.${expiry}.${sig}`)).toBeNull();

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
