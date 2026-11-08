import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   ASSIGNED LEADS ONLY — founder, 2026-11-08, verbatim:

     "Currently, all the unassigned leads are seen by everyone. I want them just
      to be seen by the admin. And whenever I assign a lead for a new user …
      they can see the lead then. They don't see the entire leads which is
      unassigned or whatever, just assigning for them. And also when I log a
      follow-up, I should be able to assign it to somebody so they have that
      follow-up in their follow-up column."

   And his answers: the follow-up hand-over MOVES the lead; "Both companies
   now"; "Give them to whoever added them".

   Everything here is REAL except the session: the real route modules, the real
   guards, the real services, the real Postgres. Mocked by module path, the
   pattern module-access.integration.test.ts established.
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));
const { localeCookie } = vi.hoisted(() => ({ localeCookie: { value: "en" } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "locale" ? { value: localeCookie.value } : undefined),
  }),
}));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Role } from "@/lib/pipeline-engine/constants";
import { isCompanyAdmin, leadScopeFor } from "@/lib/auth/lead-scope";
import { requireLeadAccess } from "@/lib/auth/guards";
import { cairoToUtc, utcToCairo } from "@/lib/datetime";
import { createLead } from "./leads";
import { listBsLeads, listOwnLeads } from "./bsystems-admin";
import { todoFor, leadScopeWhere } from "./todo";
import { calendarFor } from "./calendar";
import { salesWonLeads } from "./won-leads";
import { dailyReportFor } from "./daily-report";
import { listClients } from "./clients";
import { mentionableUsersFor } from "./comments";
import { countUnassigned, listOwnerCards } from "./sales-reps";
import { pendingUndoFor, performUndo } from "./undo";
import { followUpAssignees } from "./assignees";
import { byteforceBoardWhere, countMatchesIn } from "@/lib/crm/search-hop";
import { canExportLeads } from "@/lib/crm/leads-export";
import { canImportLeads } from "@/lib/crm/leads-import";
import { POST as bsCreate } from "@/app/api/b-systems/leads/route";
import { POST as bfCreate } from "@/app/api/byteforce/leads/route";
import { POST as bsEvent } from "@/app/api/b-systems/leads/[id]/event/route";
import { POST as bfEvent } from "@/app/api/byteforce/leads/[id]/event/route";
import { POST as bfAssign } from "@/app/api/byteforce/leads/[id]/assign/route";
import { POST as bsAssign } from "@/app/api/b-systems/leads/[id]/assign/route";
import { PATCH as bfPatch } from "@/app/api/byteforce/leads/[id]/route";
import { POST as bfArchive } from "@/app/api/byteforce/leads/[id]/archive/route";
import { POST as bfNoAnswer } from "@/app/api/byteforce/leads/[id]/no-answer/route";
import { GET as bfExport } from "@/app/api/byteforce/leads/export/route";
import { GET as bsExport } from "@/app/api/b-systems/leads/export/route";

let seq = 0;
async function makeUser(name: string, roles: Role[], opts: { active?: boolean } = {}) {
  seq += 1;
  return db.user.create({
    data: {
      name,
      phone: `+2010555${String(seq).padStart(4, "0")}`,
      passwordHash: "x",
      active: opts.active ?? true,
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

const as = (u: { id: string }) => authMock.mockResolvedValue({ user: { id: u.id } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const json = (body: unknown) =>
  new Request("http://localhost/x", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

let n = 0;
async function lead(
  brand: "bsystems" | "byteforce",
  name: string,
  opts: { ownerUserId?: string; ownerType?: string; stage?: string; archived?: boolean } = {},
) {
  n += 1;
  return db.lead.create({
    data: {
      brand,
      name,
      number: `0102000${String(n).padStart(4, "0")}`,
      type: "cold_call",
      companyName: `${name} Co`,
      ownerType: opts.ownerType ?? "internal",
      ownerUserId: opts.ownerUserId ?? null,
      stage: opts.stage ?? "new",
      archived: opts.archived ?? false,
    },
  });
}

/** Today's Cairo date, and a follow-up form for it. */
const today = () => utcToCairo(new Date()).date;
const followUp = (date = today()) => ({
  group: "follow_up" as const,
  data: { date, method: "call" as const },
});

/* the cast of every test */
async function cast() {
  const founder = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"]);
  const bsAdminOnly = await makeUser("BS Admin", ["bsystems_admin"]);
  const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
  const mona = await makeUser("Mona Seller", ["bsystems_sales"]);
  const agent = await makeUser("Karim Agent", ["bsystems_agent"]);
  const sara = await makeUser("Sara Hassan", ["byteforce_staff"]);
  const nadia = await makeUser("Nadia Staff", ["byteforce_staff"]);
  const entry = await makeUser("Hala Entry", ["bsystems_data_entry"]);
  return { founder, bsAdminOnly, omar, mona, agent, sara, nadia, entry };
}

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

/* ------------------------------------------------------------ the predicate */

describe("who is a company admin — one helper, both companies", () => {
  it("B-Systems: bsystems_admin. ByteForce: byteforce_staff AND bsystems_admin", () => {
    expect(isCompanyAdmin({ roles: ["bsystems_admin"] }, "bsystems")).toBe(true);
    expect(isCompanyAdmin({ roles: ["bsystems_sales"] }, "bsystems")).toBe(false);
    expect(isCompanyAdmin({ roles: ["byteforce_staff"] }, "byteforce")).toBe(false);
    expect(isCompanyAdmin({ roles: ["bsystems_admin"] }, "byteforce")).toBe(false);
    expect(isCompanyAdmin({ roles: ["byteforce_staff", "bsystems_admin"] }, "byteforce")).toBe(true);
    expect(leadScopeFor({ id: "u", roles: ["byteforce_staff"] }, "byteforce")).toEqual({
      kind: "own",
      userId: "u",
    });
    expect(leadScopeFor({ id: "u", roles: ["bsystems_admin"] }, "bsystems")).toEqual({ kind: "all" });
  });
});

/* -------------------------------------------- unassigned: the admin's only */

describe("unassigned leads are the company admin's alone — every surface, both companies", () => {
  it("B-Systems: board, To-Do, search hop, mentions, lead detail", async () => {
    const { bsAdminOnly, omar, agent } = await cast();
    const unowned = await lead("bsystems", "Nobody Owns Me", { stage: "following_up" });
    const mine = await lead("bsystems", "Omar Owns Me", { ownerUserId: omar.id, stage: "following_up" });
    const agents = await lead("bsystems", "Agent Owns Me", { ownerUserId: agent.id, ownerType: "agent" });

    /* the board predicates */
    expect((await listBsLeads("bsystems", "any")).map((l) => l.id).sort()).toEqual(
      [unowned.id, mine.id, agents.id].sort(),
    );
    expect((await listBsLeads("bsystems", "unassigned")).map((l) => l.id)).toEqual([unowned.id]);
    expect((await listOwnLeads("bsystems", omar.id)).map((l) => l.id)).toEqual([mine.id]);

    /* the To-Do — a follow-up due today on both internal leads */
    for (const l of [unowned, mine]) {
      await db.followUp.create({
        data: { leadId: l.id, context: "initial", dueAt: cairoToUtc(today(), "09:00"), method: "call" },
      });
    }
    const adminTodo = await todoFor({
      brand: "bsystems",
      scope: leadScopeFor({ id: bsAdminOnly.id, roles: ["bsystems_admin"] }, "bsystems"),
    });
    expect(adminTodo.today.map((i) => i.leadId).sort()).toEqual([unowned.id, mine.id].sort());
    const omarTodo = await todoFor({ brand: "bsystems", scope: { kind: "own", userId: omar.id } });
    expect(omarTodo.today.map((i) => i.leadId)).toEqual([mine.id]);

    /* the daily report / dashboard predicate */
    expect(
      await db.lead.count({ where: leadScopeWhere("bsystems", { kind: "own", userId: omar.id }) }),
    ).toBe(1);

    /* the search hop counts what the target board would show him */
    const omarUser = { id: omar.id, roles: ["bsystems_sales"] as Role[] };
    expect(await countMatchesIn("bsystems", omarUser, { search: "Nobody" })).toBe(0);
    expect(await countMatchesIn("bsystems", omarUser, { search: "Omar Owns" })).toBe(1);

    /* chat mentions: the unassigned lead's chat reaches the admins only */
    const mentionUnowned = (await mentionableUsersFor(unowned.id)).map((m) => m.userId);
    expect(mentionUnowned).toContain(bsAdminOnly.id);
    expect(mentionUnowned).not.toContain(omar.id);
    expect((await mentionableUsersFor(mine.id)).map((m) => m.userId)).toContain(omar.id);

    /* the single-lead wall */
    as(omar);
    await expect(requireLeadAccess(unowned.id)).rejects.toMatchObject({ status: 403 });
    await expect(requireLeadAccess(agents.id)).rejects.toMatchObject({ status: 403 });
    await expect(requireLeadAccess(mine.id)).resolves.toMatchObject({ isAdmin: false });
    as(bsAdminOnly);
    await expect(requireLeadAccess(unowned.id)).resolves.toMatchObject({ isAdmin: true });
  });

  it("ByteForce: the board, the owner cards, Clients, the To-Do and the lead wall", async () => {
    const { founder, sara, nadia } = await cast();
    const unowned = await lead("byteforce", "BF Unowned", { stage: "following_up" });
    const saras = await lead("byteforce", "BF Sara", { ownerUserId: sara.id, stage: "following_up" });
    const nadias = await lead("byteforce", "BF Nadia", { ownerUserId: nadia.id });

    const board = (scope: ReturnType<typeof leadScopeFor>) =>
      db.lead
        .findMany({ where: byteforceBoardWhere({}, scope), select: { id: true } })
        .then((r) => r.map((x) => x.id).sort());
    expect(
      await board(leadScopeFor({ id: founder.id, roles: ["bsystems_admin", "byteforce_staff"] }, "byteforce")),
    ).toEqual(
      [unowned.id, saras.id, nadias.id].sort(),
    );
    expect(await board(leadScopeFor({ id: sara.id, roles: ["byteforce_staff"] }, "byteforce"))).toEqual([
      saras.id,
    ]);
    expect(await countUnassigned("byteforce")).toBe(1);
    const cards = await listOwnerCards("byteforce");
    expect(cards.find((c) => c.id === sara.id)?.leadCount).toBe(1);
    expect(cards.find((c) => c.id === nadia.id)?.leadCount).toBe(1);
    /* the platform admin is a staff account too — his card holds what he took */
    expect(cards.find((c) => c.id === founder.id)?.leadCount).toBe(0);

    /* To-Do: due today on the unowned and on Sara's */
    for (const l of [unowned, saras]) {
      await db.followUp.create({
        data: { leadId: l.id, context: "initial", dueAt: cairoToUtc(today(), "09:00"), method: "call" },
      });
    }
    const saraTodo = await todoFor({ brand: "byteforce", scope: { kind: "own", userId: sara.id } });
    expect(saraTodo.today.map((i) => i.leadId)).toEqual([saras.id]);
    const adminTodo = await todoFor({ brand: "byteforce", scope: { kind: "all" } });
    expect(adminTodo.today).toHaveLength(2);

    /* Clients: Sara sees only the client of a lead she owns */
    await db.client.create({ data: { brand: "byteforce", leadId: saras.id, name: "Sara Client", number: "1" } });
    await db.client.create({ data: { brand: "byteforce", leadId: unowned.id, name: "Admin Client", number: "2" } });
    expect((await listClients("byteforce", { kind: "own", userId: sara.id })).map((c) => c.name)).toEqual([
      "Sara Client",
    ]);
    expect(await listClients("byteforce", { kind: "all" })).toHaveLength(2);

    /* search hop: Sara's hop into ByteForce counts her own cards only */
    const saraUser = { id: sara.id, roles: ["byteforce_staff"] as Role[] };
    expect(await countMatchesIn("byteforce", saraUser, { search: "BF Unowned" })).toBe(0);
    expect(await countMatchesIn("byteforce", saraUser, { search: "BF Sara" })).toBe(1);

    /* mentions: an unowned ByteForce lead reaches the ByteForce admin only */
    const m = (await mentionableUsersFor(unowned.id)).map((x) => x.userId);
    expect(m).toEqual([founder.id]);
    expect((await mentionableUsersFor(saras.id)).map((x) => x.userId).sort()).toEqual(
      [founder.id, sara.id].sort(),
    );

    /* the single-lead wall — and every per-lead WRITE route behind it */
    as(sara);
    await expect(requireLeadAccess(unowned.id)).rejects.toMatchObject({ status: 403 });
    await expect(requireLeadAccess(nadias.id)).rejects.toMatchObject({ status: 403 });
    await expect(requireLeadAccess(saras.id)).resolves.toMatchObject({ isAdmin: false });
    expect((await bfPatch(json({ name: "Renamed" }), ctx(nadias.id))).status).toBe(403);
    expect((await bfArchive(json({ value: true }), ctx(nadias.id))).status).toBe(403);
    expect((await bfNoAnswer(json({ value: true }), ctx(nadias.id))).status).toBe(403);
    expect(
      (await bfEvent(json({ event: { type: "drag", to: "following_up" }, group: followUp() }), ctx(nadias.id)))
        .status,
    ).toBe(403);
    expect((await bfPatch(json({ name: "Mine, renamed" }), ctx(saras.id))).status).toBe(200);
    as(founder);
    await expect(requireLeadAccess(unowned.id)).resolves.toMatchObject({ isAdmin: true });
  });

  it("calendar: an out-of-scope meeting is a BUSY block, the viewer's own is in full", async () => {
    const { omar, mona } = await cast();
    const omars = await lead("bsystems", "Omar Meeting Lead", { ownerUserId: omar.id, stage: "meeting_setting" });
    const monas = await lead("bsystems", "Mona Meeting Lead", { ownerUserId: mona.id, stage: "meeting_setting" });
    const at = cairoToUtc(today(), "13:00");
    await db.meeting.create({ data: { leadId: omars.id, arranged: true, datetime: at, mode: "online" } });
    await db.meeting.create({ data: { leadId: monas.id, arranged: true, datetime: at, mode: "online" } });
    const from = new Date(at.getTime() - 86_400_000);
    const to = new Date(at.getTime() + 86_400_000);
    const entries = await calendarFor({
      brand: "bsystems",
      viewer: { id: omar.id, scope: { kind: "own", userId: omar.id } },
      from,
      to,
    });
    const full = entries.filter((e) => e.detail === "full").map((e) => e.title);
    expect(full).toEqual(["Omar Meeting Lead"]);
    const busy = entries.filter((e) => e.detail === "busy");
    expect(busy).toHaveLength(1);
    expect(busy[0]!.title).toBeNull();
    expect(busy[0]!.people.map((p) => p.id)).toEqual([mona.id]);
  });

  it("daily report: a lead he worked and that was then handed away is redacted — both companies", async () => {
    const { bsAdminOnly, founder, omar, mona, sara, nadia } = await cast();
    /* each seller adds a lead today (the create route owns it to him) … */
    as(sara);
    const bfMine = await (await bfCreate(json({ name: "BF Report Lead", number: "01033330001", type: "cold_call" }))).json();
    as(omar);
    const bsMine = await (
      await bsCreate(json({ name: "BS Report Lead", number: "01033330002", type: "cold_call", companyName: "R Co" }))
    ).json();
    /* … and the admins hand both away */
    as(founder);
    expect((await bfAssign(json({ userId: nadia.id }), ctx(bfMine.id))).status).toBe(200);
    as(bsAdminOnly);
    expect((await bsAssign(json({ userId: mona.id }), ctx(bsMine.id))).status).toBe(200);

    for (const [who, brand, roles, name] of [
      [sara, "byteforce", ["byteforce_staff"], "BF Report Lead"],
      [omar, "bsystems", ["bsystems_sales"], "BS Report Lead"],
    ] as const) {
      const report = await dailyReportFor({
        actorId: who.id,
        companies: [{ brand, scope: leadScopeFor({ id: who.id, roles: [...roles] }, brand) }],
      });
      const today = report.days[0]!;
      expect(today.leadCount, name).toBe(1); // still his day — the number does not shrink
      expect(today.leads[0]!.redacted, name).toBe("out_of_scope");
      expect(JSON.stringify(report), name).not.toContain(name);
    }
  });

  it("Won Leads: internal sales sees the wins it OWNS, not the whole internal bucket", async () => {
    const { omar, mona } = await cast();
    for (const [owner, name] of [
      [omar, "Omar Win"],
      [mona, "Mona Win"],
    ] as const) {
      const l = await lead("bsystems", name, { ownerUserId: owner.id, stage: "won" });
      await db.wonDeal.create({
        data: { leadId: l.id, estimatedValue: 100, totalCommissionPercent: 0, contractDate: new Date() },
      });
    }
    expect((await salesWonLeads("bsystems", omar.id)).map((w) => w.lead.name)).toEqual(["Omar Win"]);
  });

  it("exports and imports are the COMPANY ADMIN's alone (both companies)", async () => {
    const { founder, bsAdminOnly, omar, sara } = await cast();
    expect(canExportLeads(["byteforce_staff"], "byteforce")).toBe(false);
    expect(canImportLeads(["byteforce_staff"], "byteforce")).toBe(false);
    expect(canExportLeads(["byteforce_staff", "bsystems_admin"], "byteforce")).toBe(true);
    expect(canImportLeads(["byteforce_staff", "bsystems_admin"], "byteforce")).toBe(true);
    expect(canExportLeads(["bsystems_sales"], "bsystems")).toBe(false);
    as(sara);
    expect((await bfExport()).status).toBe(403);
    as(omar);
    expect((await bsExport()).status).toBe(403);
    as(founder);
    expect((await bfExport()).status).toBe(200);
    as(bsAdminOnly);
    /* a B-Systems admin who is not ByteForce staff cannot reach ByteForce's */
    expect((await bfExport()).status).toBe(403);
  });
});

/* ------------------------------------------------------- creation defaults */

describe("creation defaults — a lead a seller adds is HIS", () => {
  it("B-Systems sales → internal, owned by the creator; data entry → unowned; admin → admin bucket", async () => {
    const { bsAdminOnly, omar, entry } = await cast();
    const body = { name: "New Co Lead", number: "01011112222", type: "cold_call", companyName: "New Co" };
    as(omar);
    const r1 = await bsCreate(json(body));
    expect(r1.status).toBe(201);
    const l1 = await r1.json();
    expect(l1).toMatchObject({ ownerType: "internal", ownerUserId: omar.id, createdByUserId: omar.id });
    as(entry);
    const l2 = await (await bsCreate(json({ ...body, number: "01011112223" }))).json();
    expect(l2).toMatchObject({ ownerType: "internal", ownerUserId: null });
    as(bsAdminOnly);
    const l3 = await (await bsCreate(json({ ...body, number: "01011112224" }))).json();
    expect(l3).toMatchObject({ ownerType: "admin", ownerUserId: bsAdminOnly.id });
  });

  it("ByteForce: a teammate's lead is his; the admin picks an owner or leaves it unassigned", async () => {
    const { founder, sara, nadia, omar } = await cast();
    const body = { name: "BF New", number: "01022223333", type: "cold_call" };
    as(sara);
    const mine = await (await bfCreate(json(body))).json();
    expect(mine.ownerUserId).toBe(sara.id);
    /* a teammate cannot name anybody else */
    expect((await bfCreate(json({ ...body, number: "01022223334", ownerUserId: nadia.id }))).status).toBe(403);
    as(founder);
    const unassigned = await (await bfCreate(json({ ...body, number: "01022223335" }))).json();
    expect(unassigned.ownerUserId).toBeNull();
    const handed = await (
      await bfCreate(json({ ...body, number: "01022223336", ownerUserId: nadia.id }))
    ).json();
    expect(handed.ownerUserId).toBe(nadia.id);
    /* an owner who is not ByteForce staff is refused */
    expect((await bfCreate(json({ ...body, number: "01022223337", ownerUserId: omar.id }))).status).toBe(400);
  });
});

/* -------------------------------------------- the ByteForce assign route */

describe("POST /api/byteforce/leads/[id]/assign — the ByteForce admin only", () => {
  it("admin 200 (log, bell, undo); staff 403; an invalid target refused", async () => {
    const { founder, sara, nadia, omar } = await cast();
    const l = await lead("byteforce", "Assign Me");
    as(sara);
    expect((await bfAssign(json({ userId: sara.id }), ctx(l.id))).status).toBe(403);
    as(omar);
    expect((await bfAssign(json({ userId: sara.id }), ctx(l.id))).status).toBe(403);

    as(founder);
    const ok = await bfAssign(json({ userId: sara.id }), ctx(l.id));
    expect(ok.status).toBe(200);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).ownerUserId).toBe(sara.id);
    expect(
      await db.activityLog.count({ where: { entityId: l.id, trigger: "assigned", actorId: founder.id } }),
    ).toBe(1);
    const bell = await db.notification.findFirstOrThrow({ where: { userId: sara.id } });
    expect(bell).toMatchObject({ type: "assigned", leadId: l.id });
    expect((await pendingUndoFor(founder.id))?.label).toContain("Assign Me");

    /* invalid targets: not ByteForce staff, deactivated, unknown */
    expect((await bfAssign(json({ userId: omar.id }), ctx(l.id))).status).toBe(400);
    const gone = await makeUser("Gone BF", ["byteforce_staff"], { active: false });
    expect((await bfAssign(json({ userId: gone.id }), ctx(l.id))).status).toBe(400);
    expect((await bfAssign(json({ userId: "nope" }), ctx(l.id))).status).toBe(404);
    /* a B-Systems lead through the ByteForce door is not found */
    const bs = await lead("bsystems", "Wrong Door");
    expect((await bfAssign(json({ userId: nadia.id }), ctx(bs.id))).status).toBe(404);
    /* and the B-Systems route refuses a ByteForce lead */
    expect((await bsAssign(json({ userId: omar.id }), ctx(l.id))).status).toBe(404);
    /* an archived lead is refused */
    const archived = await lead("byteforce", "Archived BF", { archived: true });
    expect((await bfAssign(json({ userId: nadia.id }), ctx(archived.id))).status).toBe(400);
  });
});

/* ----------------------------------------- the follow-up hand-over */

describe("follow-up hand-over — 'the lead moves to them'", () => {
  it("B-Systems: the admin hands a follow-up to Omar — same transaction, he sees it; undo gives it back", async () => {
    const { bsAdminOnly, omar, mona } = await cast();
    const l = await lead("bsystems", "Hand Me Over", { ownerUserId: mona.id, stage: "new" });

    /* not the admin → 403, and nothing at all is written */
    as(mona);
    const refused = await bsEvent(
      json({ event: { type: "next_action", action: "following_up" }, group: followUp(), assignTo: omar.id }),
      ctx(l.id),
    );
    expect(refused.status).toBe(403);
    expect(await db.followUp.count({ where: { leadId: l.id } })).toBe(0);

    as(bsAdminOnly);
    /* an invalid assignee is refused BEFORE anything is written */
    const entryUser = await makeUser("Entry Two", ["bsystems_data_entry"]);
    const bad = await bsEvent(
      json({ event: { type: "next_action", action: "following_up" }, group: followUp(), assignTo: entryUser.id }),
      ctx(l.id),
    );
    expect(bad.status).toBe(400);
    expect(await db.followUp.count({ where: { leadId: l.id } })).toBe(0);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).stage).toBe("new");

    const res = await bsEvent(
      json({ event: { type: "next_action", action: "following_up" }, group: followUp(), assignTo: omar.id }),
      ctx(l.id),
    );
    expect(res.status).toBe(200);
    const moved = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(moved).toMatchObject({ stage: "following_up", ownerUserId: omar.id, ownerType: "internal" });
    expect(await db.followUp.count({ where: { leadId: l.id } })).toBe(1);
    expect(await db.activityLog.count({ where: { entityId: l.id, trigger: "assigned" } })).toBe(1);
    const bell = await db.notification.findFirstOrThrow({ where: { userId: omar.id } });
    expect(bell).toMatchObject({ type: "assigned", leadId: l.id });
    expect(bell.body).toContain("follow-up");

    /* Omar now sees it: his board's Following Up column and his To-Do today */
    const board = await listOwnLeads("bsystems", omar.id);
    expect(board.map((x) => [x.id, x.stage])).toEqual([[l.id, "following_up"]]);
    const todo = await todoFor({ brand: "bsystems", scope: { kind: "own", userId: omar.id } });
    expect(todo.today.map((i) => i.leadId)).toEqual([l.id]);
    /* and Mona, the previous owner, does not */
    expect(await listOwnLeads("bsystems", mona.id)).toEqual([]);
    as(mona);
    await expect(requireLeadAccess(l.id)).rejects.toMatchObject({ status: 403 });

    /* UNDO: one action, one inverse — the follow-up goes AND the lead goes back */
    await performUndo({ id: bsAdminOnly.id, label: bsAdminOnly.name });
    const back = await db.lead.findUniqueOrThrow({ where: { id: l.id } });
    expect(back).toMatchObject({ stage: "new", ownerUserId: mona.id, ownerType: "internal" });
    expect(await db.followUp.count({ where: { leadId: l.id } })).toBe(0);
  });

  it("ByteForce: the admin hands a same-stage follow-up to Nadia; a non-follow-up move cannot carry one", async () => {
    const { founder, sara, nadia } = await cast();
    const l = await lead("byteforce", "BF Hand Over", { ownerUserId: sara.id, stage: "following_up" });
    as(sara);
    expect(
      (
        await bfEvent(
          json({ event: { type: "next_action", action: "follow_up_again" }, group: followUp(), assignTo: nadia.id }),
          ctx(l.id),
        )
      ).status,
    ).toBe(403);

    as(founder);
    /* a meeting is not a follow-up — no hand-over rides on it */
    const wrong = await bfEvent(
      json({
        event: { type: "next_action", action: "meeting_setting" },
        group: { group: "meeting", data: { arranged: true, date: today(), time: "12:00", mode: "online" } },
        assignTo: nadia.id,
      }),
      ctx(l.id),
    );
    expect(wrong.status).toBe(400);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).stage).toBe("following_up");

    const ok = await bfEvent(
      json({ event: { type: "next_action", action: "follow_up_again" }, group: followUp(), assignTo: nadia.id }),
      ctx(l.id),
    );
    expect(ok.status).toBe(200);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).ownerUserId).toBe(nadia.id);
    const nadiaTodo = await todoFor({ brand: "byteforce", scope: { kind: "own", userId: nadia.id } });
    expect(nadiaTodo.today.map((i) => i.leadId)).toEqual([l.id]);
    expect((await todoFor({ brand: "byteforce", scope: { kind: "own", userId: sara.id } })).today).toEqual([]);
    /* a ByteForce follow-up cannot be handed to somebody outside ByteForce */
    const omarLike = await makeUser("BS Only", ["bsystems_sales"]);
    expect(
      (
        await bfEvent(
          json({ event: { type: "next_action", action: "follow_up_again" }, group: followUp(), assignTo: omarLike.id }),
          ctx(l.id),
        )
      ).status,
    ).toBe(400);
  });

  it("keeping the current owner writes no hand-over at all", async () => {
    const { bsAdminOnly, omar } = await cast();
    const l = await lead("bsystems", "Keep Owner", { ownerUserId: omar.id, stage: "new" });
    as(bsAdminOnly);
    const res = await bsEvent(
      json({ event: { type: "next_action", action: "following_up" }, group: followUp() }),
      ctx(l.id),
    );
    expect(res.status).toBe(200);
    expect((await db.lead.findUniqueOrThrow({ where: { id: l.id } })).ownerUserId).toBe(omar.id);
    expect(await db.activityLog.count({ where: { entityId: l.id, trigger: "assigned" } })).toBe(0);
    expect(await db.notification.count()).toBe(0);
  });

  it("the select's options are exactly the targets the server accepts", async () => {
    const { bsAdminOnly, founder, omar, agent, sara, nadia, entry } = await cast();
    const bs = (await followUpAssignees("bsystems", bsAdminOnly, "en")).map((o) => o.id);
    expect(bs[0]).toBe(bsAdminOnly.id); // "(me)" first
    expect(bs).toEqual(expect.arrayContaining([omar.id, agent.id]));
    expect(bs).not.toContain(entry.id);
    expect(bs).not.toContain(sara.id);
    const bf = (await followUpAssignees("byteforce", founder, "en")).map((o) => o.id);
    expect(bf.sort()).toEqual([founder.id, sara.id, nadia.id].sort());
  });
});
