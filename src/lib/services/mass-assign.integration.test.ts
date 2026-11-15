import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Role } from "@/lib/pipeline-engine/constants";
import {
  listMassAssignCandidates,
  massAssignCompaniesFor,
  massAssignLeads,
  massAssignSchema,
  MASS_ASSIGN_MAX,
  parseCandidateFilters,
  stageOptionsFor,
} from "./mass-assign";
import { listOwnLeads } from "./bsystems-admin";
import { pendingUndoFor, performUndo } from "./undo";

/* ADR-105 — founder, 2026-11-15: "add a way to mass assign leads to someone —
   I can choose them in the users section and select mass assign and select
   from the crms both crms". The single hand-over, many times, in one
   transaction: the same refusals, one history row per lead, ONE bell for the
   new owner, ONE undo step for the batch. */

let seq = 0;
async function makeUser(name: string, roles: Role[], extra: Record<string, unknown> = {}) {
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${seq++}`,
      passwordHash: "x",
      roles: { create: roles.map((role) => ({ role })) },
      ...extra,
    },
    include: { roles: true },
  });
}
const viewerOf = (u: { id: string; name: string; roles: Array<{ role: string }> }) => ({
  id: u.id,
  name: u.name,
  roles: u.roles.map((r) => r.role as Role),
});

async function makeLead(
  name: string,
  brand: "bsystems" | "byteforce",
  extra: { ownerUserId?: string | null; ownerType?: string; stage?: string; archived?: boolean; companyName?: string } = {},
) {
  return db.lead.create({
    data: {
      brand,
      name,
      number: `0101${String(seq++).padStart(7, "0")}`,
      type: "cold_call",
      ownerType: extra.ownerType ?? "internal",
      ownerUserId: extra.ownerUserId ?? null,
      stage: extra.stage ?? "new",
      archived: extra.archived ?? false,
      companyName: extra.companyName ?? null,
    },
  });
}

const owner = async (id: string) =>
  db.lead.findUniqueOrThrow({ where: { id }, select: { ownerUserId: true, ownerType: true, updatedAt: true } });

beforeEach(async () => {
  await resetDb();
});

describe("mass assign — the write", () => {
  it("hands every chosen lead of BOTH CRMs to one person in one press: ownership, a history row each, ONE bell, ONE undo", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Dual Seller", ["bsystems_sales", "byteforce_staff"]);
    const bsFree = await makeLead("BS Free", "bsystems");
    const bsAdmins = await makeLead("BS Admins", "bsystems", { ownerType: "admin", ownerUserId: founder.id });
    const bfFree = await makeLead("BF Free", "byteforce", { ownerType: "internal" });

    const result = await massAssignLeads(viewerOf(founder), target.id, [bsFree.id, bsAdmins.id, bfFree.id]);
    expect(result).toEqual({ assigned: 3, alreadyTheirs: 0 });

    /* B-Systems: the bucket comes from his role; ByteForce keeps the lead's own */
    expect(await owner(bsFree.id)).toMatchObject({ ownerUserId: target.id, ownerType: "internal" });
    expect(await owner(bsAdmins.id)).toMatchObject({ ownerUserId: target.id, ownerType: "internal" });
    expect(await owner(bfFree.id)).toMatchObject({ ownerUserId: target.id, ownerType: "internal" });

    const history = await db.activityLog.findMany({ where: { trigger: "assigned" } });
    expect(history.map((h) => h.entityId).sort()).toEqual([bsFree.id, bsAdmins.id, bfFree.id].sort());
    expect(new Set(history.map((h) => h.actorId))).toEqual(new Set([founder.id]));

    const bell = await db.notification.findMany({ where: { userId: target.id } });
    expect(bell).toHaveLength(1);
    expect(bell[0]!.title).toBe("Assigned to you: 3 leads");
    expect(bell[0]!.leadId).toBeNull();
    expect(bell[0]!.body).toContain("Founder made you the owner of 3 leads");

    expect((await pendingUndoFor(founder.id))?.label).toBe("Assigned 3 leads to Dual Seller");
  });

  it("ONE lead reads exactly like the single hand-over: its own bell, deep-linked, and the single undo entry", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Solo Seller", ["bsystems_sales"]);
    const lead = await makeLead("Solo Co", "bsystems", { companyName: "Solo Ltd" });

    await massAssignLeads(viewerOf(founder), target.id, [lead.id]);
    const bell = await db.notification.findMany({ where: { userId: target.id } });
    expect(bell).toHaveLength(1);
    expect(bell[0]).toMatchObject({
      title: "Assigned to you: Solo Co",
      body: 'Founder made you the owner of "Solo Co" (Solo Ltd).',
      leadId: lead.id,
    });
    const entry = await db.undoEntry.findFirstOrThrow({ where: { userId: founder.id } });
    expect(entry.kind).toBe("lead_assign");
    expect(entry.label).toBe("Assigned Solo Co to Solo Seller");
  });

  it("a lead that is already his is counted, not rewritten — no history row, no bump", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Has One", ["bsystems_sales"]);
    const his = await makeLead("Already His", "bsystems", { ownerUserId: target.id });
    const free = await makeLead("Free One", "bsystems");
    const before = await owner(his.id);

    expect(await massAssignLeads(viewerOf(founder), target.id, [his.id, free.id])).toEqual({
      assigned: 1,
      alreadyTheirs: 1,
    });
    expect((await owner(his.id)).updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
    const history = await db.activityLog.findMany({ where: { trigger: "assigned" } });
    expect(history.map((h) => h.entityId)).toEqual([free.id]);
  });

  it("taking leads YOURSELF (ByteForce) rings nobody's bell", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const a = await makeLead("Self A", "byteforce");
    const b = await makeLead("Self B", "byteforce");
    expect((await massAssignLeads(viewerOf(founder), founder.id, [a.id, b.id])).assigned).toBe(2);
    expect(await db.notification.count()).toBe(0);
    expect((await owner(a.id)).ownerUserId).toBe(founder.id);
  });
});

describe("mass assign — undo is ONE step for the whole batch, all or nothing", () => {
  it("gives every lead back to its OWN previous owner, with a history row each", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const other = await makeUser("Other Seller", ["bsystems_sales"]);
    const target = await makeUser("New Seller", ["bsystems_sales"]);
    const free = await makeLead("Was Free", "bsystems");
    const others = await makeLead("Was Other's", "bsystems", { ownerUserId: other.id });
    const admins = await makeLead("Was Admin's", "bsystems", { ownerType: "admin", ownerUserId: founder.id });

    await massAssignLeads(viewerOf(founder), target.id, [free.id, others.id, admins.id]);
    const undone = await performUndo({ id: founder.id, label: founder.name });
    expect(undone.label).toBe("Assigned 3 leads to New Seller");

    expect(await owner(free.id)).toMatchObject({ ownerUserId: null, ownerType: "internal" });
    expect(await owner(others.id)).toMatchObject({ ownerUserId: other.id, ownerType: "internal" });
    expect(await owner(admins.id)).toMatchObject({ ownerUserId: founder.id, ownerType: "admin" });
    const undoRows = await db.activityLog.findMany({ where: { trigger: "undo" } });
    expect(undoRows.map((r) => r.entityId).sort()).toEqual([free.id, others.id, admins.id].sort());
    expect(await pendingUndoFor(founder.id)).toBeNull();
  });

  it("works across BOTH companies: ByteForce keeps its own bucket, B-Systems gets its old one back", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Dual Seller", ["bsystems_sales", "byteforce_staff"]);
    const agentUser = await makeUser("An Agent", ["bsystems_agent"]);
    const staffUser = await makeUser("A Teammate", ["byteforce_staff"]);
    const bsAgents = await makeLead("Was the agent's", "bsystems", { ownerType: "agent", ownerUserId: agentUser.id });
    const bfStaffs = await makeLead("Was the teammate's", "byteforce", { ownerUserId: staffUser.id });
    await massAssignLeads(viewerOf(founder), target.id, [bsAgents.id, bfStaffs.id]);
    expect(await owner(bsAgents.id)).toMatchObject({ ownerUserId: target.id, ownerType: "internal" });
    /* the previous owners lose them — their own lists no longer carry them */
    expect((await listOwnLeads("bsystems", agentUser.id)).map((l) => l.id)).toEqual([]);
    expect((await listOwnLeads("byteforce", staffUser.id)).map((l) => l.id)).toEqual([]);
    expect((await listOwnLeads("byteforce", target.id)).map((l) => l.id)).toEqual([bfStaffs.id]);

    await performUndo({ id: founder.id, label: founder.name });
    expect(await owner(bsAgents.id)).toMatchObject({ ownerUserId: agentUser.id, ownerType: "agent" });
    expect(await owner(bfStaffs.id)).toMatchObject({ ownerUserId: staffUser.id, ownerType: "internal" });
    expect(await listOwnLeads("byteforce", target.id)).toEqual([]);
  });

  it("only the admin who did it can undo it", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const otherAdmin = await makeUser("Other Admin", ["bsystems_admin"]);
    const target = await makeUser("Seller", ["bsystems_sales"]);
    const a = await makeLead("Mine To Undo A", "bsystems");
    const c = await makeLead("Mine To Undo B", "bsystems");
    await massAssignLeads(viewerOf(founder), target.id, [a.id, c.id]);
    await expect(performUndo({ id: otherAdmin.id, label: otherAdmin.name })).rejects.toThrow(/Nothing to undo/);
    expect((await owner(a.id)).ownerUserId).toBe(target.id);
  });

  it("refuses — nothing undone — when a lead of the batch was deleted, or a previous owner no longer exists", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Seller", ["bsystems_sales"]);
    const leaver = await makeUser("Leaver", ["bsystems_sales"]);
    const a = await makeLead("Deleted Later", "bsystems");
    const c = await makeLead("Stays", "bsystems");
    await massAssignLeads(viewerOf(founder), target.id, [a.id, c.id]);
    await db.lead.delete({ where: { id: a.id } });
    await expect(performUndo({ id: founder.id, label: founder.name })).rejects.toMatchObject({ status: 409 });
    expect((await owner(c.id)).ownerUserId).toBe(target.id);

    /* a second batch whose previous owner is then deleted outright */
    const d = await makeLead("Leaver's A", "bsystems", { ownerUserId: leaver.id });
    const e = await makeLead("Leaver's B", "bsystems", { ownerUserId: leaver.id });
    await massAssignLeads(viewerOf(founder), target.id, [d.id, e.id]);
    await db.user.delete({ where: { id: leaver.id } });
    await expect(performUndo({ id: founder.id, label: founder.name })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("previous owners no longer exists"),
    });
    expect((await owner(d.id)).ownerUserId).toBe(target.id);
  });

  it("refuses — and changes nothing — when ONE lead of the batch has been touched since", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Busy Seller", ["bsystems_sales"]);
    const a = await makeLead("Touched", "bsystems");
    const b = await makeLead("Untouched", "bsystems");
    await massAssignLeads(viewerOf(founder), target.id, [a.id, b.id]);
    /* the new owner starts working one of them */
    await db.lead.update({ where: { id: a.id }, data: { description: "called him" } });

    await expect(performUndo({ id: founder.id, label: founder.name })).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("nothing was undone"),
    });
    expect((await owner(a.id)).ownerUserId).toBe(target.id);
    expect((await owner(b.id)).ownerUserId).toBe(target.id);
    /* the entry is still there — the refusal rolled its claim back */
    expect(await pendingUndoFor(founder.id)).not.toBeNull();
  });
});

describe("mass assign — the single hand-over's refusals, and nothing half-done", () => {
  it("a B-Systems-only admin cannot hand out a ByteForce lead — it reads as GONE, and the B-Systems lead beside it stays put", async () => {
    const bsAdmin = await makeUser("BS Admin", ["bsystems_admin"]);
    const target = await makeUser("Dual", ["bsystems_sales", "byteforce_staff"]);
    const bs = await makeLead("BS Side", "bsystems");
    const bf = await makeLead("BF Side", "byteforce");
    /* review: a company he does not run answers like a lead that does not
       exist, so the difference tells him nothing */
    await expect(massAssignLeads(viewerOf(bsAdmin), target.id, [bs.id, bf.id])).rejects.toMatchObject({
      status: 404,
    });
    await expect(massAssignLeads(viewerOf(bsAdmin), target.id, [bs.id, "no-such-lead"])).rejects.toMatchObject({
      status: 404,
    });
    expect((await owner(bs.id)).ownerUserId).toBeNull();
    expect((await owner(bf.id)).ownerUserId).toBeNull();
  });

  it("a target who is admin AND sales lands B-Systems leads in the admin bucket — resolveAssignee's rule", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const both = await makeUser("Admin Seller", ["bsystems_admin", "bsystems_sales"]);
    const a = await makeLead("Bucket A", "bsystems");
    const c = await makeLead("Bucket B", "bsystems");
    await massAssignLeads(viewerOf(founder), both.id, [a.id, c.id]);
    expect(await owner(a.id)).toMatchObject({ ownerUserId: both.id, ownerType: "admin" });
  });

  it("a person who cannot own that company's leads is refused, with the single assign's words", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const bsOnly = await makeUser("BS Only", ["bsystems_sales"]);
    const bs = await makeLead("Fine", "bsystems");
    const bf = await makeLead("Not His Company", "byteforce");
    await expect(massAssignLeads(viewerOf(founder), bsOnly.id, [bs.id, bf.id])).rejects.toMatchObject({
      status: 400,
      message: "Assign a ByteForce lead to a ByteForce staff account",
    });
    expect((await owner(bs.id)).ownerUserId).toBeNull();
  });

  it("an archived lead, a lead that is gone, a deactivated person and a non-admin are all refused", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Seller", ["bsystems_sales"]);
    const fine = await makeLead("Fine", "bsystems");
    const archived = await makeLead("Archived", "bsystems", { archived: true });
    const v = viewerOf(founder);

    await expect(massAssignLeads(v, target.id, [fine.id, archived.id])).rejects.toMatchObject({ status: 400 });
    await expect(massAssignLeads(v, target.id, [fine.id, "no-such-lead"])).rejects.toMatchObject({ status: 404 });
    const gone = await makeUser("Gone", ["bsystems_sales"], { active: false });
    await expect(massAssignLeads(v, gone.id, [fine.id])).rejects.toMatchObject({
      status: 400,
      message: "That account is deactivated",
    });
    const seller = await makeUser("Not Admin", ["bsystems_sales"]);
    await expect(massAssignLeads(viewerOf(seller), target.id, [fine.id])).rejects.toMatchObject({ status: 403 });
    expect((await owner(fine.id)).ownerUserId).toBeNull();
    expect(await db.activityLog.count({ where: { trigger: "assigned" } })).toBe(0);
  });

  it("the request carries one to MASS_ASSIGN_MAX leads", () => {
    expect(massAssignSchema.safeParse({ leadIds: [] }).success).toBe(false);
    expect(massAssignSchema.safeParse({ leadIds: ["a"] }).success).toBe(true);
    const tooMany = Array.from({ length: MASS_ASSIGN_MAX + 1 }, (_, i) => `id${i}`);
    expect(massAssignSchema.safeParse({ leadIds: tooMany }).success).toBe(false);
  });
});

describe("mass assign — who gets the button, and the list he sees", () => {
  const founder = { roles: ["bsystems_admin", "byteforce_staff"] as Role[] };
  const live = (roles: Role[], extra: Partial<{ active: boolean; registrationStatus: string }> = {}) => ({
    active: true,
    registrationStatus: "approved",
    roles,
    ...extra,
  });

  it("follows the Assign roster, narrowed to the companies the viewer runs", () => {
    expect(massAssignCompaniesFor(live(["bsystems_sales"]), founder)).toEqual(["bsystems"]);
    expect(massAssignCompaniesFor(live(["bsystems_agent"]), founder)).toEqual(["bsystems"]);
    expect(massAssignCompaniesFor(live(["bsystems_partner"]), founder)).toEqual(["bsystems"]);
    expect(massAssignCompaniesFor(live(["byteforce_staff"]), founder)).toEqual(["byteforce"]);
    expect(massAssignCompaniesFor(live(["bsystems_sales", "byteforce_staff"]), founder)).toEqual([
      "bsystems",
      "byteforce",
    ]);
    expect(massAssignCompaniesFor(live(["bsystems_data_entry"]), founder)).toEqual([]);
    expect(massAssignCompaniesFor(live(["bsystems_admin"]), founder)).toEqual([]);
    expect(massAssignCompaniesFor(live(["bsystems_sales"], { active: false }), founder)).toEqual([]);
    expect(massAssignCompaniesFor(live(["bsystems_sales"], { registrationStatus: "pending" }), founder)).toEqual([]);
    /* a B-Systems-only admin does not run ByteForce */
    expect(massAssignCompaniesFor(live(["byteforce_staff"]), { roles: ["bsystems_admin"] })).toEqual([]);
    expect(massAssignCompaniesFor(live(["bsystems_sales"]), { roles: ["bsystems_sales"] })).toEqual([]);
  });

  it("lists his companies' live leads that are not his yet; the default is the admin's pile, open stages only", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const target = await makeUser("Target", ["bsystems_sales"]);
    const rival = await makeUser("Rival", ["bsystems_sales"]);
    const free = await makeLead("Free Lead", "bsystems");
    const mine = await makeLead("Admin Lead", "bsystems", { ownerType: "admin", ownerUserId: admin.id });
    const rivals = await makeLead("Rival Lead", "bsystems", { ownerUserId: rival.id });
    const won = await makeLead("Won Lead", "bsystems", { stage: "won" });
    await makeLead("His Already", "bsystems", { ownerUserId: target.id });
    await makeLead("Archived Lead", "bsystems", { archived: true });
    await makeLead("ByteForce Lead", "byteforce"); // not a company he can own

    const companies = massAssignCompaniesFor(
      { active: true, registrationStatus: "approved", roles: ["bsystems_sales"] },
      { roles: ["bsystems_admin", "byteforce_staff"] },
    );
    const list = (params: Record<string, string>) =>
      listMassAssignCandidates(admin.id, target.id, companies, parseCandidateFilters(params, companies));

    const byDefault = await list({});
    expect(byDefault.rows.map((r) => r.name).sort()).toEqual(["Admin Lead", "Free Lead"]);
    expect(byDefault.total).toBe(2);
    expect(byDefault.owners).toEqual([{ id: rival.id, name: "Rival", count: 1 }]);

    expect((await list({ owner: "any" })).rows.map((r) => r.id).sort()).toEqual(
      [free.id, mine.id, rivals.id].sort(),
    );
    expect((await list({ owner: rival.id })).rows.map((r) => r.id)).toEqual([rivals.id]);
    expect((await list({ owner: "unassigned" })).rows.map((r) => r.id)).toEqual([free.id]);
    expect((await list({ owner: "mine" })).rows.map((r) => r.id)).toEqual([mine.id]);
    expect((await list({ owner: "any", stage: "any" })).total).toBe(4);
    expect((await list({ stage: "won", owner: "any" })).rows.map((r) => r.id)).toEqual([won.id]);
    expect((await list({ q: "free" })).rows.map((r) => r.id)).toEqual([free.id]);
  });

  it("the stages come from each company's own pipeline: ByteForce has no Negotiation, and Open hides each one's own Won and Lost", async () => {
    const admin = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const staff = await makeUser("BF Target", ["byteforce_staff"]);
    const bfOnly = massAssignCompaniesFor(
      { active: true, registrationStatus: "approved", roles: ["byteforce_staff"] },
      { roles: ["bsystems_admin", "byteforce_staff"] },
    );
    expect(stageOptionsFor(bfOnly)).not.toContain("negotiation");
    expect(stageOptionsFor(["bsystems"])).toContain("negotiation");
    expect(parseCandidateFilters({ stage: "negotiation" }, bfOnly).stage).toBe("open");
    const openOne = await makeLead("BF Open", "byteforce", { stage: "meeting_setting" });
    await makeLead("BF Won", "byteforce", { stage: "won" });
    await makeLead("BF Lost", "byteforce", { stage: "lost" });
    const list = await listMassAssignCandidates(admin.id, staff.id, bfOnly, parseCandidateFilters({}, bfOnly));
    expect(list.rows.map((r) => r.id)).toEqual([openOne.id]);
  });

  it("parses the filters to safe defaults", () => {
    expect(parseCandidateFilters({}, ["bsystems", "byteforce"])).toEqual({
      company: "both",
      owner: "free",
      stage: "open",
      q: "",
    });
    expect(parseCandidateFilters({ company: "byteforce" }, ["bsystems"]).company).toBe("bsystems");
    expect(parseCandidateFilters({ stage: "bogus", owner: "x y" }, ["bsystems"])).toMatchObject({
      stage: "open",
      owner: "free",
    });
  });
});
