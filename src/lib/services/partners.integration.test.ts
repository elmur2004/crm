import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  addAlternativeNumbers,
  addRecording,
  applyProspectEvent,
  createProspect,
  createProspectSchema,
  deletePartner,
  deleteProspect,
  getPartnerDetail,
  getProspectDetail,
  listPartners,
  parseNumbers,
  prospectKindWhere,
  prospectSearchWhere,
  updatePartner,
  updateProspect,
} from "./partners";
import { applyLeadEvent, createLead } from "./leads";
import { listAgentsDetailed } from "./bsystems-admin";
import { signupRep } from "./portal-reps";
import { verifyPassword } from "@/lib/auth/hash";
import { storage, validateAndStore } from "@/lib/storage";
import type { Actor } from "./activity";

/* §13 integration obligations for Phase 2: PP-2 auto-return on new number, PP-4
   partner conversion (gate blocks until complete), PP-5 partner-lead attribution
   into the CRM, upload validation (type/size) for recordings. */

const actor: Actor = { id: null, label: "Test B-Staff" };
const role = "bsystems_admin" as const;

function makeProspect() {
  return createProspect(
    {
      kind: "partner" as const,
      name: "Hany Mansour",
      companyName: "Mansour Trading",
      number: "0223456789",
      businessActivity: "Import/export",
    },
    actor,
  );
}

const COMPLETE_GATE = {
  companyName: "Mansour Trading",
  keyPersonName: "Hany Mansour",
  keyPersonRole: "CEO",
  address: "45 Nile Corniche, Cairo",
  number: "0223456789",
  businessActivity: "Import/export",
  importance: "high" as const,
};

beforeEach(async () => {
  await resetDb();
});

describe("Partners pipeline (§10.2)", () => {
  it("PP-1 (V2 §6): didn't answer records the dialed number(s) into non-answering", async () => {
    const p = await makeProspect();
    const r = await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["0223456789"] } },
      actor,
      role,
    });
    expect(r.toStage).toBe("didnt_answer");
    const { prospect } = await getProspectDetail(p.id);
    expect(parseNumbers(prospect.nonAnsweringNumbers)).toEqual(["0223456789"]);
  });

  it("PP-2 (V2 §6): alternative numbers auto-return the card to Lead — unbounded loop", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["0223456789"] } },
      actor,
      role,
    });

    /* One alternative number → auto-return. */
    let updated = await addAlternativeNumbers(p.id, ["0101111111"], actor, role);
    expect(updated.stage).toBe("lead");
    expect(parseNumbers(updated.alternativeNumbers)).toEqual(["0101111111"]);
    const log1 = await db.activityLog.findFirst({
      where: { entityType: "partner_prospect", entityId: p.id, trigger: "PP-2" },
    });
    expect(log1!.action).toBe("auto_transfer");

    /* Loop again: back to Didn't Answer, add TWO more — no cap (V2). */
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["0101111111"] } },
      actor,
      role,
    });
    updated = await addAlternativeNumbers(p.id, ["0102222222", "0103333333"], actor, role);
    expect(updated.stage).toBe("lead");
    expect(parseNumbers(updated.alternativeNumbers)).toEqual([
      "0101111111",
      "0102222222",
      "0103333333",
    ]);
    expect(parseNumbers(updated.nonAnsweringNumbers)).toEqual(["0223456789", "0101111111"]);
    const pp2Count = await db.activityLog.count({
      where: { entityType: "partner_prospect", entityId: p.id, trigger: "PP-2" },
    });
    expect(pp2Count).toBe(2);
  });

  it("PP-2 does not fire outside Didn't Answer (numbers can be added any time)", async () => {
    const p = await makeProspect();
    const updated = await addAlternativeNumbers(p.id, ["0104444444"], actor, role);
    expect(updated.stage).toBe("lead"); // was already lead; numbers stored, no transition
    const pp2 = await db.activityLog.findFirst({
      where: { entityType: "partner_prospect", entityId: p.id, trigger: "PP-2" },
    });
    expect(pp2).toBeNull();
  });

  it("PP-3 + ADR-010: partners meeting-attended cannot target a proposals stage", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "meeting_setting" },
      group: {
        group: "meeting",
        data: { arranged: true, date: "2026-09-10", time: "12:00", mode: "offline" },
      },
      actor,
      role,
    });
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "meeting_outcome", outcome: "attended", destination: "sending_proposal" },
        actor,
        role,
      }),
    ).rejects.toThrow();
  });

  it("PP-4: the Won gate blocks until every required field is present, then converts", async () => {
    const p = await makeProspect();

    /* Incomplete gate → schema rejects, nothing moves, no partner. */
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "won" },
        group: {
          group: "won_partner",
          data: { companyName: "Mansour Trading" } as never,
        },
        actor,
        role,
      }),
    ).rejects.toThrow();
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("lead");
    expect(await db.partner.count()).toBe(0);

    /* Complete gate → Won + Partner in directory with date_joined, Converted badge. */
    const before = new Date();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("won"); // stays in Won as history (A-5)
    expect(prospect.converted).toBe(true);
    const partner = await db.partner.findUnique({ where: { prospectId: p.id } });
    expect(partner).toBeTruthy();
    expect(partner!.companyName).toBe("Mansour Trading");
    expect(partner!.importance).toBe("high");
    expect(partner!.dateJoined.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
    const log = await db.activityLog.findFirst({
      where: { entityType: "partner", entityId: partner!.id, trigger: "PP-4" },
    });
    expect(log).toBeTruthy();
  });

  it("PP-5: a partner lead lands in the B-Systems CRM with permanent attribution and live stage", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });

    const lead = await createLead(
      "bsystems",
      { name: "Referred Corp", number: "0109999999", type: "personal_connection" },
      actor,
      { attribution: { partnerId: partner.id } },
    );
    expect(lead.source).toBe("partner");
    expect(lead.partnerId).toBe(partner.id);
    const createLog = await db.activityLog.findFirst({
      where: { entityType: "lead", entityId: lead.id, trigger: "PP-5" },
    });
    expect(createLog).toBeTruthy();

    /* Next action moves it through the NORMAL internal pipeline; attribution survives. */
    await applyLeadEvent({
      brand: "bsystems",
      leadId: lead.id,
      event: { type: "next_action", action: "following_up" },
      group: {
        group: "follow_up",
        data: { date: "2026-09-12", time: "09:00", method: "call" },
      },
      actor,
      role,
    });
    const detail = await getPartnerDetail(partner.id);
    expect(detail.leads).toHaveLength(1);
    expect(detail.leads[0]!.stage).toBe("following_up"); // live link, not a copy
    const fresh = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(fresh.partnerId).toBe(partner.id); // permanent (§5.5)
  });
});

describe("Founder V4: draggable board + admin edit/delete", () => {
  it("a drag is the same move as the matching action — target group enforced, intake-return free", async () => {
    const p = await makeProspect();

    /* Drag to Didn't Answer without the numbers group → blocked. */
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "drag", to: "didnt_answer" },
        actor,
        role,
      }),
    ).rejects.toThrow(/numbers/);

    /* With the group → moves and records the dialed number. */
    const moved = await applyProspectEvent({
      prospectId: p.id,
      event: { type: "drag", to: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["0223456789"] } },
      actor,
      role,
    });
    expect(moved.toStage).toBe("didnt_answer");

    /* Drag back to the Lead column needs no form (board's direct commit). */
    const back = await applyProspectEvent({
      prospectId: p.id,
      event: { type: "drag", to: "lead" },
      actor,
      role,
    });
    expect(back.toStage).toBe("lead");
  });

  it("dragging into Won runs the PP-4 completeness gate and converts", async () => {
    const p = await makeProspect();
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "drag", to: "won" },
        actor,
        role,
      }),
    ).rejects.toThrow(/won_partner/);

    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "drag", to: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("won");
    expect(prospect.converted).toBe(true);
    expect(await db.partner.count({ where: { prospectId: p.id } })).toBe(1);
  });

  it("deleteProspect removes the card, its records and files, and its Partner — leads survive unattributed", async () => {
    const p = await makeProspect();
    const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(1024, 1)]);
    const attachment = await addRecording(p.id, new File([mp3], "call.mp3", { type: "audio/mpeg" }), actor);
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    const lead = await createLead(
      "bsystems",
      { name: "Referred Corp", number: "0109999999", type: "personal_connection" },
      actor,
      { attribution: { partnerId: partner.id } },
    );

    await deleteProspect(p.id, actor);

    expect(await db.partnerProspect.count({ where: { id: p.id } })).toBe(0);
    expect(await db.partner.count({ where: { id: partner.id } })).toBe(0);
    expect(await db.attachment.count({ where: { partnerProspectId: p.id } })).toBe(0);
    const survivor = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(survivor.partnerId).toBeNull(); // the lead keeps living, unattributed
    await expect(storage.read(attachment.storageKey)).rejects.toThrow(); // file gone too
  });

  it("updatePartner edits directory fields; deletePartner clears attribution but keeps lead + prospect", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });

    const edited = await updatePartner(
      partner.id,
      { keyPersonName: "Salma Mansour", importance: "medium" },
      actor,
    );
    expect(edited.keyPersonName).toBe("Salma Mansour");
    expect(edited.importance).toBe("medium");
    expect(edited.companyName).toBe("Mansour Trading"); // untouched fields survive

    const lead = await createLead(
      "bsystems",
      { name: "Referred Corp", number: "0109999999", type: "personal_connection" },
      actor,
      { attribution: { partnerId: partner.id } },
    );
    await deletePartner(partner.id, actor);

    expect(await db.partner.count({ where: { id: partner.id } })).toBe(0);
    const survivor = await db.lead.findUniqueOrThrow({ where: { id: lead.id } });
    expect(survivor.partnerId).toBeNull();
    /* The pipeline card stays in Won as history. */
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("won");
  });
});

describe("Upload validation (§7.2, §15)", () => {
  it("accepts a genuine mp3 recording and stores it retrievably", async () => {
    const p = await makeProspect();
    const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(2048, 1)]);
    const file = new File([mp3], "cold call #1.mp3", { type: "audio/mpeg" });
    const attachment = await addRecording(p.id, file, actor);
    expect(attachment.kind).toBe("recording");
    expect(attachment.size).toBe(2051);
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.recordings).toHaveLength(1);
  });

  it("rejects wrong extension, mismatched content, and oversized files", async () => {
    /* Wrong extension for a recording. */
    await expect(
      validateAndStore("recording", new File([Buffer.from("ID3aaa")], "call.wav")),
    ).rejects.toThrow(/Allowed file types/);

    /* Extension says mp3, content is not. */
    await expect(
      validateAndStore("recording", new File([Buffer.alloc(64, 0)], "call.mp3")),
    ).rejects.toThrow(/does not match/);

    /* CV over the 10 MB cap. */
    const big = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(10 * 1024 * 1024 + 1)]);
    await expect(validateAndStore("cv", new File([big], "cv.pdf"))).rejects.toThrow(/too large/);

    /* ADR-053 upgrade: a bare ZIP renamed .docx no longer passes — the OOXML
       container itself is inspected ([Content_Types].xml + the word/ prefix). */
    const bareZip = Buffer.concat([Buffer.from("PK\u0003\u0004"), Buffer.alloc(256, 2)]);
    await expect(validateAndStore("cv", new File([bareZip], "cv.docx"))).rejects.toThrow(
      /does not match/,
    );

    /* A real OOXML wordprocessing container passes. */
    const docx = Buffer.concat([
      Buffer.from("PK\u0003\u0004"),
      Buffer.from("[Content_Types].xml word/document.xml"),
      Buffer.alloc(256, 2),
    ]);
    const stored = await validateAndStore("cv", new File([docx], "cv.docx"));
    expect(stored.key).toMatch(/\.docx$/);
  });
});

/* ---------------------------------------------------------------------------
   Founder: "I want the CRM of the partners to be the CRM of the partners AND
   agents." One board, two kinds of card — the pipeline is unchanged, the field
   set and the Won gate are not. PP-4a is the agent gate.
   --------------------------------------------------------------------------- */

const PDF = Buffer.concat([Buffer.from("%PDF-1.7"), Buffer.alloc(2048, 7)]);
const cvFile = () => new File([PDF], "cv.pdf", { type: "application/pdf" });

function makeAgent(overrides: Record<string, unknown> = {}) {
  return createProspect(
    {
      kind: "agent" as const,
      name: "Nour Adel",
      number: "01099887766",
      email: "nour.adel@example.com",
      address: "12 Tahrir St, Giza",
      speciality: "ERP consulting",
      ...overrides,
    },
    actor,
  );
}

const AGENT_GATE = {
  firstName: "Nour",
  lastName: "Adel",
  address: "12 Tahrir St, Giza",
  speciality: "ERP consulting",
  email: "nour.adel@example.com",
  password: "agentpass123",
  phone: "01099887766",
};

async function agentToWon(prospectId: string, gate = AGENT_GATE) {
  return applyProspectEvent({
    prospectId,
    event: { type: "next_action", action: "won" },
    group: { group: "won_agent", data: gate },
    actor,
    role,
  });
}

describe("Partners & Agents: kind-conditional validation", () => {
  it("a PARTNER card still requires company name and business activity", () => {
    const missing = createProspectSchema.safeParse({
      kind: "partner",
      name: "Hany Mansour",
      number: "0223456789",
      businessActivity: "Import/export",
    });
    expect(missing.success).toBe(false);
    expect(JSON.stringify(missing.error?.issues)).toMatch(/companyName/);

    const noActivity = createProspectSchema.safeParse({
      kind: "partner",
      name: "Hany Mansour",
      companyName: "Mansour Trading",
      number: "0223456789",
    });
    expect(noActivity.success).toBe(false);
    expect(JSON.stringify(noActivity.error?.issues)).toMatch(/businessActivity/);

    /* the original shape still parses, and kind defaults to partner */
    const ok = createProspectSchema.safeParse({
      name: "Hany Mansour",
      companyName: "Mansour Trading",
      number: "0223456789",
      businessActivity: "Import/export",
    });
    expect(ok.success).toBe(true);
    expect(ok.data!.kind).toBe("partner");
  });

  /* Founder: "everything is optional other than the name and the number...
     just to not confuse this one" — the admin usually opens an agent card
     mid-phone-call. The requirements live at the Won gate instead. */
  it("an AGENT card needs ONLY a name and a number", async () => {
    const minimal = createProspectSchema.safeParse({
      kind: "agent",
      name: "Nour Adel",
      number: "01099887766",
    });
    expect(minimal.success).toBe(true);

    /* and it really saves that way — no company fields, no signup fields */
    const saved = await createProspect(minimal.data!, actor);
    expect(saved.kind).toBe("agent");
    expect(saved.name).toBe("Nour Adel");
    expect(saved.email).toBeNull();
    expect(saved.address).toBeNull();
    expect(saved.speciality).toBeNull();
    expect(saved.companyName).toBeNull();
    expect(saved.businessActivity).toBeNull();
    expect(saved.stage).toBe("lead");

    /* the number is one of the two mandatory fields, so it is held to the
       signup form's rule */
    const badNumber = createProspectSchema.safeParse({
      kind: "agent",
      name: "Nour Adel",
      number: "not-a-phone",
    });
    expect(badNumber.success).toBe(false);
    expect(JSON.stringify(badNumber.error?.issues)).toMatch(/valid phone/);

    const noName = createProspectSchema.safeParse({ kind: "agent", number: "01099887766" });
    expect(noName.success).toBe(false);
  });

  it("the kind is fixed at creation — an edit can never switch the field set", async () => {
    const p = await makeAgent();
    /* the payload has no `kind` at all (the schema drops it), and the partner
       columns stay null however the caller phrases the edit */
    const edited = await updateProspect(
      p.id,
      { name: "Nour A. Adel", companyName: "Sneaky Co", businessActivity: "HR company" },
      actor,
    );
    expect(edited.kind).toBe("agent");
    expect(edited.name).toBe("Nour A. Adel");
    expect(edited.companyName).toBeNull();
    expect(edited.businessActivity).toBeNull();

    /* a PARTNER card keeps its own rules on edit — "the partners as it is" */
    const partnerCard = await makeProspect();
    await expect(updateProspect(partnerCard.id, { companyName: "" }, actor)).rejects.toThrow(
      /Company name/,
    );
  });
});

describe("PP-4a: the agent Won gate creates the account", () => {
  it("runs the full pipeline and mints User + role + PortalRep with a working password", async () => {
    const p = await makeAgent();
    expect(p.kind).toBe("agent");
    expect(p.companyName).toBeNull();

    /* the SHARED pipeline: didn't answer -> new number -> follow-up */
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["01099887766"] } },
      actor,
      role,
    });
    const returned = await addAlternativeNumbers(p.id, ["01055554444"], actor, role);
    expect(returned.stage).toBe("lead"); // PP-2 works on agent cards too
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "following_up" },
      group: { group: "follow_up", data: { date: "2026-09-12", time: "10:00", method: "call" } },
      actor,
      role,
    });

    /* the gate holds until it is complete — an agent card cannot use the
       partner gate, and an incomplete agent gate is refused */
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "won" },
        group: { group: "won_partner", data: COMPLETE_GATE },
        actor,
        role,
      }),
    ).rejects.toThrow(/won_agent/);
    await expect(agentToWon(p.id, { ...AGENT_GATE, password: "short" })).rejects.toThrow();
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("following_up");
    expect(await db.user.count({ where: { email: AGENT_GATE.email } })).toBe(0);

    await agentToWon(p.id);

    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("won");
    expect(prospect.converted).toBe(true);

    const user = await db.user.findUniqueOrThrow({
      where: { email: "nour.adel@example.com" },
      include: { roles: true, portalRep: true },
    });
    expect(user.name).toBe("Nour Adel");
    expect(user.phone).toBe("01099887766");
    expect(user.active).toBe(true);
    /* founder: the admin created them, so they never sit in Registrations */
    expect(user.registrationStatus).toBe("approved");
    expect(user.roles.map((r) => r.role)).toEqual(["bsystems_agent"]);
    expect(await verifyPassword("agentpass123", user.passwordHash)).toBe(true);
    expect(user.passwordPlain).toBe("agentpass123"); // admin-visibility rule
    expect(user.portalRep!.firstName).toBe("Nour");
    expect(user.portalRep!.lastName).toBe("Adel");
    expect(user.portalRep!.address).toBe("12 Tahrir St, Giza");
    expect(user.portalRep!.speciality).toBe("ERP consulting");
    expect(prospect.agentUserId).toBe(user.id);

    /* PP-4a is on the record, and NO directory partner was created */
    const log = await db.activityLog.findFirst({
      where: { entityType: "portal_rep", entityId: user.portalRep!.id, trigger: "PP-4a" },
    });
    expect(log).toBeTruthy();
    expect(await db.partner.count()).toBe(0);
  });

  /* The founder's trade: adding is frictionless, the GATE is strict. A card
     created with nothing but a name and a number cannot become an account
     until the admin supplies everything PortalRep and the login need. */
  it("refuses a bare card until address, speciality, email and password are given", async () => {
    const p = await createProspect(
      { kind: "agent" as const, name: "Nour Adel", number: "01099887766" },
      actor,
    );
    const bare = { firstName: "Nour", lastName: "Adel", phone: "01099887766" };

    await expect(agentToWon(p.id, bare as never)).rejects.toThrow(/Address is required/);
    await expect(
      agentToWon(p.id, { ...bare, address: "12 Tahrir St, Giza" } as never),
    ).rejects.toThrow(/Speciality is required/);
    await expect(
      agentToWon(p.id, {
        ...bare,
        address: "12 Tahrir St, Giza",
        speciality: "ERP consulting",
      } as never),
    ).rejects.toThrow(/sign-in/); // the email IS the login
    const named = {
      ...bare,
      address: "12 Tahrir St, Giza",
      speciality: "ERP consulting",
      email: "nour.adel@example.com",
    };
    await expect(agentToWon(p.id, named as never)).rejects.toThrow(/sign-in password/);
    await expect(agentToWon(p.id, { ...named, password: "short" } as never)).rejects.toThrow(
      /8 characters/,
    );

    /* nothing was created by any of those attempts */
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("lead");
    expect(await db.portalRep.count()).toBe(0);

    /* complete → the account exists, built entirely from gate input */
    await agentToWon(p.id);
    const rep = await db.portalRep.findFirstOrThrow();
    expect(rep.address).toBe("12 Tahrir St, Giza");
    expect(rep.speciality).toBe("ERP consulting");
  });

  it("a converted agent appears in Agents and NEVER in the partners directory", async () => {
    const p = await makeAgent();
    await agentToWon(p.id);

    const agents = await listAgentsDetailed();
    expect(agents.map((a) => `${a.firstName} ${a.lastName}`)).toContain("Nour Adel");
    expect(await listPartners()).toHaveLength(0);

    /* and the partner side is untouched: a partner card still converts to a
       directory Partner and creates no agent profile */
    const partnerCard = await makeProspect();
    await applyProspectEvent({
      prospectId: partnerCard.id,
      event: { type: "next_action", action: "won" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    expect((await listPartners()).map((x) => x.companyName)).toEqual(["Mansour Trading"]);
    expect(await listAgentsDetailed()).toHaveLength(1); // still just the agent
  });

  it("refuses a duplicate email or phone with a clear message, and nothing is written", async () => {
    const first = await makeAgent();
    await agentToWon(first.id);

    const dupEmail = await makeAgent({ number: "01077776666", email: "other@example.com" });
    await expect(agentToWon(dupEmail.id)).rejects.toThrow(/email already exists/);

    const dupPhone = await makeAgent({ number: "01066665555", email: "third@example.com" });
    await expect(
      agentToWon(dupPhone.id, { ...AGENT_GATE, email: "third@example.com" }),
    ).rejects.toThrow(/phone number already exists/);

    /* both cards stayed put; only the first account exists */
    expect((await getProspectDetail(dupEmail.id)).prospect.stage).toBe("lead");
    expect((await getProspectDetail(dupPhone.id)).prospect.stage).toBe("lead");
    expect(await db.portalRep.count()).toBe(1);
    expect(await db.user.count({ where: { email: "third@example.com" } })).toBe(0);
  });

  it("the CV collected on the card becomes the agent's profile CV — one file, never orphaned", async () => {
    const p = await createProspect(
      {
        kind: "agent" as const,
        name: "Nour Adel",
        number: "01099887766",
        email: "nour.adel@example.com",
        address: "12 Tahrir St, Giza",
        speciality: "ERP consulting",
      },
      actor,
      { cv: cvFile() },
    );

    /* it hangs off the card and is NOT in the recordings player list */
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.cv?.filename).toBe("cv.pdf");
    expect(prospect.recordings).toHaveLength(0);
    const key = prospect.cv!.storageKey;

    await agentToWon(p.id);

    const rep = await db.portalRep.findFirstOrThrow({ include: { cv: true } });
    expect(rep.cv?.filename).toBe("cv.pdf");
    expect(rep.cv?.storageKey).toBe(key); // moved, not copied
    expect(await db.attachment.count({ where: { partnerProspectId: p.id } })).toBe(0);
    await expect(storage.read(key)).resolves.toBeTruthy(); // the file survived
  });
});

describe("Registrations stay separate from the board", () => {
  it("a public signup creates a pending user and NO pipeline card", async () => {
    const before = await db.partnerProspect.count();
    const { userId } = await signupRep(
      {
        firstName: "Walid",
        lastName: "Sami",
        phone: "01033332222",
        email: "walid.sami@example.com",
        address: "5 Corniche, Alexandria",
        speciality: "Logistics software",
        password: "applicant123",
        confirmPassword: "applicant123",
      },
      cvFile(),
    );
    const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
    expect(user.registrationStatus).toBe("pending"); // waits in Registrations
    /* the founder's rule: an applicant waits in the registration, they do not
       appear on the board — only the ones the admin puts there do */
    expect(await db.partnerProspect.count()).toBe(before);
    expect(await db.partnerProspect.count({ where: { email: "walid.sami@example.com" } })).toBe(0);
  });
});

describe("Founder: the board's Kind filter + search narrow SERVER-SIDE", () => {
  it("kind, one-box search (name/company/number, digits-aware), and their composition", async () => {
    await makeProspect(); // partner — "Mansour Trading", 0223456789
    await createProspect({ kind: "agent", name: "Aya Selim", number: "01099887766" }, actor);

    /* All | Partners | Agents */
    expect(await db.partnerProspect.count({ where: prospectKindWhere("any") })).toBe(2);
    const agents = await db.partnerProspect.findMany({ where: prospectKindWhere("agent") });
    expect(agents.map((p) => p.name)).toEqual(["Aya Selim"]);
    const partners = await db.partnerProspect.findMany({ where: prospectKindWhere("partner") });
    expect(partners.map((p) => p.companyName)).toEqual(["Mansour Trading"]);

    /* the lead boards' search semantics: case-insensitive company/name match,
       and a spaced phone query finds the packed number */
    expect(
      await db.partnerProspect.count({ where: prospectSearchWhere("mansour trading") }),
    ).toBe(1);
    const byNumber = await db.partnerProspect.findMany({
      where: prospectSearchWhere("010 9988"),
    });
    expect(byNumber.map((p) => p.name)).toEqual(["Aya Selim"]);

    /* the two controls compose into one where clause */
    expect(
      await db.partnerProspect.count({
        where: { ...prospectKindWhere("agent"), ...prospectSearchWhere("mansour") },
      }),
    ).toBe(0);
    expect(await db.partnerProspect.count({ where: prospectSearchWhere("") })).toBe(2);
  });
});
