import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  addAlternativeNumbers,
  addRecording,
  applyProspectEvent,
  createAgentAccount,
  createPartnerLogin,
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
import { pendingUndoFor, performUndo } from "./undo";
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

  it("PP-4: the Qualified gate blocks until every required field is present, then converts", async () => {
    const p = await makeProspect();

    /* Incomplete gate → schema rejects, nothing moves, no partner. */
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "qualified" },
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

    /* Complete gate → Qualified + Partner in the directory with date_joined and
       the Converted badge — and NO credentials asked for anywhere (ADR-059). */
    const before = new Date();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("qualified"); // stays in Qualified as history (A-5)
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

  /* founder 1.2 — "The system should not require any additional details or
     mandatory fields when moving a lead to Contacted." */
  it("PP-3: Lead → Contacted commits with NO group at all, and writes NO follow-up", async () => {
    for (const card of [await makeProspect(), await makeAgent()]) {
      const moved = await applyProspectEvent({
        prospectId: card.id,
        event: { type: "next_action", action: "contacted" },
        actor,
        role,
      });
      expect(moved.toStage).toBe("contacted");
      const { prospect } = await getProspectDetail(card.id);
      expect(prospect.stage).toBe("contacted");
      /* item 2.1: contacted means contacted — nothing was scheduled */
      expect(prospect.followUps).toHaveLength(0);
      /* the drag is the same move, and equally silent */
      await applyProspectEvent({
        prospectId: card.id,
        event: { type: "drag", to: "lead" },
        actor,
        role,
      });
      await applyProspectEvent({
        prospectId: card.id,
        event: { type: "drag", to: "contacted" },
        actor,
        role,
      });
      expect((await getProspectDetail(card.id)).prospect.followUps).toHaveLength(0);
    }
  });

  /* founder 1.1 — "Add a new stage called Waiting... Leads in Waiting must
     remain fully editable at any time." */
  it("PP-7: Waiting takes no group, stays fully editable, and moves out both ways", async () => {
    for (const card of [await makeProspect(), await makeAgent()]) {
      await applyProspectEvent({
        prospectId: card.id,
        event: { type: "next_action", action: "meeting_setting" },
        group: {
          group: "meeting",
          data: { arranged: true, date: "2026-09-10", time: "11:00", mode: "online" as const },
        },
        actor,
        role,
      });
      const intoWaiting = await applyProspectEvent({
        prospectId: card.id,
        event: { type: "next_action", action: "waiting" },
        actor,
        role,
      });
      expect(intoWaiting.toStage).toBe("waiting");

      /* FULLY EDITABLE: every field the kind owns still saves, from Waiting */
      const edited = await updateProspect(
        card.id,
        card.kind === "agent"
          ? { name: "Edited In Waiting", number: "01055551111", description: "still editable" }
          : { name: "Edited In Waiting", companyName: "Edited Co", description: "still editable" },
        actor,
      );
      expect(edited.name).toBe("Edited In Waiting");
      expect(edited.description).toBe("still editable");
      expect(edited.stage).toBe("waiting"); // the edit never moved it
      expect(
        await db.activityLog.count({
          where: { entityType: "partner_prospect", entityId: card.id, trigger: "edit" },
        }),
      ).toBe(1);
      /* alternative numbers are live here too — nothing is locked */
      await addAlternativeNumbers(card.id, ["01044443333"], actor, role);
      expect((await getProspectDetail(card.id)).prospect.stage).toBe("waiting");

      /* OUT again, BACKWARDS — and then back in, forwards from Contacted */
      await applyProspectEvent({
        prospectId: card.id,
        event: { type: "next_action", action: "contacted" },
        actor,
        role,
      });
      expect((await getProspectDetail(card.id)).prospect.stage).toBe("contacted");
      await applyProspectEvent({
        prospectId: card.id,
        event: { type: "drag", to: "waiting" },
        actor,
        role,
      });
      expect((await getProspectDetail(card.id)).prospect.stage).toBe("waiting");
    }
  });

  /* founder 1.3 — the partner gate never asks for credentials */
  it("PP-4: the Qualified gate takes no password, and converts with no email at all", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE }, // no email, no password
      actor,
      role,
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.email).toBeNull();
    expect(partner.userId).toBeNull();
    expect(await db.user.count()).toBe(0);

    /* an email alone is fine now — the old "email ⇒ password" refine is gone */
    const withEmail = await makeProspect();
    await applyProspectEvent({
      prospectId: withEmail.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: { ...COMPLETE_GATE, email: "hany@example.com" } },
      actor,
      role,
    });
    expect(
      (await db.partner.findUniqueOrThrow({ where: { prospectId: withEmail.id } })).email,
    ).toBe("hany@example.com");
    expect(await db.user.count()).toBe(0); // still no login minted by the move

    /* every OTHER completeness requirement is preserved */
    for (const field of ["businessActivity", "importance", "keyPersonRole", "address"] as const) {
      const bad = await makeProspect();
      const gate: Record<string, unknown> = { ...COMPLETE_GATE };
      delete gate[field];
      await expect(
        applyProspectEvent({
          prospectId: bad.id,
          event: { type: "next_action", action: "qualified" },
          group: { group: "won_partner", data: gate as never },
          actor,
          role,
        }),
      ).rejects.toThrow();
      expect((await getProspectDetail(bad.id)).prospect.stage).toBe("lead");
    }
  });

  it("PP-5: a partner lead lands in the B-Systems CRM with permanent attribution and live stage", async () => {
    const p = await makeProspect();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
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

  it("dragging into Qualified runs the PP-4 completeness gate and converts", async () => {
    const p = await makeProspect();
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "drag", to: "qualified" },
        actor,
        role,
      }),
    ).rejects.toThrow(/won_partner/);

    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "drag", to: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("qualified");
    expect(prospect.converted).toBe(true);
    expect(await db.partner.count({ where: { prospectId: p.id } })).toBe(1);
  });

  it("deleteProspect removes the card, its records and files, and its Partner — leads survive unattributed", async () => {
    const p = await makeProspect();
    const mp3 = Buffer.concat([Buffer.from("ID3"), Buffer.alloc(1024, 1)]);
    const attachment = await addRecording(p.id, new File([mp3], "call.mp3", { type: "audio/mpeg" }), actor);
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
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
      event: { type: "next_action", action: "qualified" },
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
    /* The pipeline card stays in Qualified as history. */
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("qualified");
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

/* ADR-059 — founder item 1.3: "Moving a lead to Qualified should not require
   creating or entering an email or password." Qualifying an agent is a PURE
   move now: no group at all. The credentials live in the separate account
   action below, which is what `AGENT_GATE` feeds. */
async function agentToQualified(prospectId: string) {
  return applyProspectEvent({
    prospectId,
    event: { type: "next_action", action: "qualified" },
    actor,
    role,
  });
}

/** the same move, attributed to a specific admin — undo entries are per user */
async function agentToQualifiedAs(prospectId: string, who: Actor) {
  return applyProspectEvent({
    prospectId,
    event: { type: "next_action", action: "qualified" },
    actor: who,
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

describe("PP-6 (§10.2): qualifying an AGENT creates nothing at all", () => {
  it("runs the shared pipeline and lands in Qualified with no group, no user, no profile", async () => {
    const p = await makeAgent();
    expect(p.kind).toBe("agent");
    expect(p.companyName).toBeNull();

    /* the SHARED pipeline — one stage set for both kinds (ADR-059) */
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "didnt_answer" },
      group: { group: "numbers", data: { dialedNumbers: ["01099887766"] } },
      actor,
      role,
    });
    const returned = await addAlternativeNumbers(p.id, ["01055554444"], actor, role);
    expect(returned.stage).toBe("lead"); // PP-2 works on agent cards too
    const autoReturn = await db.activityLog.findFirstOrThrow({
      where: { entityType: "partner_prospect", entityId: p.id, action: "auto_transfer" },
    });
    expect(autoReturn.trigger).toBe("PP-2"); // one row family for both kinds now

    const users = await db.user.count();
    await agentToQualified(p.id);

    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("qualified");
    /* the whole point: NOTHING was minted, and the card says so honestly */
    expect(prospect.converted).toBe(false);
    expect(prospect.agentUserId).toBeNull();
    expect(await db.user.count()).toBe(users);
    expect(await db.portalRep.count()).toBe(0);
    expect(await db.partner.count()).toBe(0);

    const move = await db.activityLog.findFirstOrThrow({
      where: { entityType: "partner_prospect", entityId: p.id, toStage: "qualified" },
    });
    expect(move.trigger).toBe("PP-6");
  });

  it("an agent's Qualified move is now UNDOABLE — nothing irreversible happened", async () => {
    const p = await makeAgent();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "waiting" },
      actor: { id: "admin-undo", label: "Admin" },
      role,
    });
    await agentToQualifiedAs(p.id, { id: "admin-undo", label: "Admin" });
    const pending = await pendingUndoFor("admin-undo");
    expect(pending).toBeTruthy();
    await performUndo({ id: "admin-undo", label: "Admin" });
    expect((await getProspectDetail(p.id)).prospect.stage).toBe("waiting");
  });

  it("the retired vocabulary is gone: `won` is not an action and `won_agent` is not a group", async () => {
    const p = await makeAgent();
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "won" },
        actor,
        role,
      }),
    ).rejects.toThrow(/not available/);
    await expect(
      applyProspectEvent({
        prospectId: p.id,
        event: { type: "next_action", action: "qualified" },
        group: { group: "won_agent", data: AGENT_GATE } as never,
        actor,
        role,
      }),
    ).rejects.toThrow();
  });
});

describe("PP-4a (§7.2b): the login is a SEPARATE, explicit admin action", () => {
  it("mints User + role + PortalRep with a working password, and re-parents the CV", async () => {
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
    const beforeCv = (await getProspectDetail(p.id)).prospect.cv!;
    expect(beforeCv.filename).toBe("cv.pdf");
    const key = beforeCv.storageKey;

    await agentToQualified(p.id);
    await createAgentAccount(p.id, AGENT_GATE, actor);

    const user = await db.user.findUniqueOrThrow({
      where: { email: "nour.adel@example.com" },
      include: { roles: true, portalRep: { include: { cv: true } } },
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
    expect(user.portalRep!.address).toBe("12 Tahrir St, Giza");
    expect(user.portalRep!.speciality).toBe("ERP consulting");
    /* the CV moved, never copied — same stored file, no orphan */
    expect(user.portalRep!.cv?.storageKey).toBe(key);
    expect(await db.attachment.count({ where: { partnerProspectId: p.id } })).toBe(0);
    await expect(storage.read(key)).resolves.toBeTruthy();

    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.converted).toBe(true);
    expect(prospect.agentUserId).toBe(user.id);
    expect(prospect.stage).toBe("qualified"); // the action never moves the card

    /* PP-4a keeps its historic row id on the portal_rep entry */
    expect(
      await db.activityLog.count({
        where: { entityType: "portal_rep", entityId: user.portalRep!.id, trigger: "PP-4a" },
      }),
    ).toBe(1);
    expect(
      await db.activityLog.count({ where: { entityType: "user", trigger: "agent_account" } }),
    ).toBe(1);
    expect(await db.partner.count()).toBe(0);
  });

  it("refuses everything it should: wrong stage, wrong kind, twice, duplicate email or phone", async () => {
    const p = await makeAgent();
    /* the card must be Qualified first — the founder's semantic */
    await expect(createAgentAccount(p.id, AGENT_GATE, actor)).rejects.toThrow(/Qualified first/);
    await agentToQualified(p.id);

    await createAgentAccount(p.id, AGENT_GATE, actor);
    /* a double-click cannot mint a second account */
    await expect(createAgentAccount(p.id, AGENT_GATE, actor)).rejects.toThrow(/already has an account/);

    const dupEmail = await makeAgent({ number: "01077776666", email: "other@example.com" });
    await agentToQualified(dupEmail.id);
    await expect(createAgentAccount(dupEmail.id, AGENT_GATE, actor)).rejects.toThrow(
      /email already exists/,
    );
    await expect(
      createAgentAccount(dupEmail.id, { ...AGENT_GATE, email: "third@example.com" }, actor),
    ).rejects.toThrow(/phone number already exists/);
    /* nothing partial was written by either refusal */
    expect(await db.portalRep.count()).toBe(1);
    expect(await db.user.count({ where: { email: "third@example.com" } })).toBe(0);

    /* and a partner card is not an agent */
    const partnerCard = await makeProspect();
    await applyProspectEvent({
      prospectId: partnerCard.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    await expect(createAgentAccount(partnerCard.id, AGENT_GATE, actor)).rejects.toThrow(
      /not an agent/,
    );
  });

  /* The founder's trade: adding is frictionless and QUALIFYING is free — the
     strictness moved to this form, which is the last honest place to insist on
     the columns PortalRep and the login need. */
  it("demands address, speciality, email and password — here, and only here", async () => {
    const p = await createProspect(
      { kind: "agent" as const, name: "Nour Adel", number: "01099887766" },
      actor,
    );
    await agentToQualified(p.id); // a bare card qualifies with no trouble at all
    const bare = { firstName: "Nour", lastName: "Adel", phone: "01099887766" };

    await expect(createAgentAccount(p.id, bare as never, actor)).rejects.toThrow(
      /Address is required/,
    );
    await expect(
      createAgentAccount(p.id, { ...bare, address: "12 Tahrir St, Giza" } as never, actor),
    ).rejects.toThrow(/Speciality is required/);
    await expect(
      createAgentAccount(
        p.id,
        { ...bare, address: "12 Tahrir St, Giza", speciality: "ERP consulting" } as never,
        actor,
      ),
    ).rejects.toThrow(/sign-in/); // the email IS the login
    const named = {
      ...bare,
      address: "12 Tahrir St, Giza",
      speciality: "ERP consulting",
      email: "nour.adel@example.com",
    };
    await expect(createAgentAccount(p.id, named as never, actor)).rejects.toThrow(
      /sign-in password/,
    );
    await expect(
      createAgentAccount(p.id, { ...named, password: "short" } as never, actor),
    ).rejects.toThrow(/8 characters/);

    /* nothing was created by any of those attempts, and the card is still a
       perfectly good qualified agent with no login */
    expect(await db.portalRep.count()).toBe(0);
    const { prospect } = await getProspectDetail(p.id);
    expect(prospect.stage).toBe("qualified");
    expect(prospect.converted).toBe(false);

    await createAgentAccount(p.id, AGENT_GATE, actor);
    const rep = await db.portalRep.findFirstOrThrow();
    expect(rep.address).toBe("12 Tahrir St, Giza");
    expect(rep.speciality).toBe("ERP consulting");
  });

  it("an account-minted agent appears in Agents and NEVER in the partners directory", async () => {
    const p = await makeAgent();
    await agentToQualified(p.id);
    await createAgentAccount(p.id, AGENT_GATE, actor);

    const agents = await listAgentsDetailed();
    expect(agents.map((a) => `${a.firstName} ${a.lastName}`)).toContain("Nour Adel");
    expect(await listPartners()).toHaveLength(0);

    /* and the partner side is untouched: a partner card still converts to a
       directory Partner and creates no agent profile */
    const partnerCard = await makeProspect();
    await applyProspectEvent({
      prospectId: partnerCard.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    expect((await listPartners()).map((x) => x.companyName)).toEqual(["Mansour Trading"]);
    expect(await listAgentsDetailed()).toHaveLength(1); // still just the agent
  });

  it("minting is never undoable — it retires the admin's pending entries", async () => {
    const who = { id: "admin-mint", label: "Admin" };
    const p = await makeAgent();
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "waiting" },
      actor: who,
      role,
    });
    await agentToQualifiedAs(p.id, who);
    expect(await pendingUndoFor("admin-mint")).toBeTruthy();
    await createAgentAccount(p.id, AGENT_GATE, who);
    expect(await pendingUndoFor("admin-mint")).toBeNull();
  });

  it("the PARTNER half: a qualified partner joins the directory with NO login, then gets one", async () => {
    const p = await makeProspect();
    /* founder 1.3 — the gate accepts no email at all, and refuses a password */
    await applyProspectEvent({
      prospectId: p.id,
      event: { type: "next_action", action: "qualified" },
      group: { group: "won_partner", data: COMPLETE_GATE },
      actor,
      role,
    });
    const partner = await db.partner.findUniqueOrThrow({ where: { prospectId: p.id } });
    expect(partner.userId).toBeNull(); // a directory partner with no login is normal
    expect(await db.user.count({ where: { roles: { some: { role: "bsystems_partner" } } } })).toBe(0);

    await createPartnerLogin(
      p.id,
      { email: "Mansour.Trading@example.com", password: "partnerpass1" },
      actor,
    );
    const linked = await db.partner.findUniqueOrThrow({
      where: { id: partner.id },
      include: { user: { include: { roles: true } } },
    });
    expect(linked.user!.email).toBe("mansour.trading@example.com"); // lower-cased
    expect(linked.user!.roles.map((r) => r.role)).toEqual(["bsystems_partner"]);
    expect(await verifyPassword("partnerpass1", linked.user!.passwordHash)).toBe(true);
    /* twice is refused, and so is a duplicate email */
    await expect(
      createPartnerLogin(p.id, { email: "x@example.com", password: "partnerpass1" }, actor),
    ).rejects.toThrow(/already has an account/);
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
