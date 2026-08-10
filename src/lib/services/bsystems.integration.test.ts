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
import {
  approveRegistration,
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

describe("PP-4 partner account provisioning (founder: admin sets the credentials)", () => {
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
        name: "Hany Mansour",
        companyName: "Mansour Trading",
        number: "0223456789",
        businessActivity: "Import/export",
      },
      admin,
    );
  }

  it("conversion with email + password creates the login with EXACTLY those credentials", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
      group: {
        group: "won_partner",
        data: { ...GATE, email: "hany@mansour.example", password: "Mansour#2026" },
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
    expect(await verifyPassword("Mansour#2026", user.passwordHash)).toBe(true);
  });

  it("an email WITHOUT a password is refused — nothing converts", async () => {
    const p = await makeProspect();
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "won" },
        group: {
          group: "won_partner",
          data: { ...GATE, email: "hany@mansour.example" },
        },
        actor: admin,
        role: "bsystems_admin",
      }),
    ).rejects.toThrow();
    expect(await db.partner.count()).toBe(0);
    expect(await db.user.count({ where: { email: "hany@mansour.example" } })).toBe(0);
  });

  it("no email at all still converts the partner without a login (unchanged)", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
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
