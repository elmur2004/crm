import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import {
  addAlternativeNumbers,
  addRecording,
  applyProspectEvent,
  createProspect,
  getPartnerDetail,
  getProspectDetail,
  parseNumbers,
  updateProspect,
} from "./partners";
import { applyLeadEvent, createLead } from "./leads";
import { validateAndStore } from "@/lib/storage";
import type { Actor } from "./activity";

/* §13 integration obligations for Phase 2: PP-2 auto-return on new number, PP-4
   partner conversion (gate blocks until complete), PP-5 partner-lead attribution
   into the CRM, upload validation (type/size) for recordings. */

const actor: Actor = { id: null, label: "Test B-Staff" };
const role = "bsystems_admin" as const;

function makeProspect() {
  return createProspect(
    {
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

    /* Valid docx magic passes. */
    const docx = Buffer.concat([Buffer.from("PK"), Buffer.alloc(256, 2)]);
    const stored = await validateAndStore("cv", new File([docx], "cv.docx"));
    expect(stored.key).toMatch(/\.docx$/);
  });
});
