import { beforeEach, describe, expect, it, vi } from "vitest";

/* The ONE piece of the request that cannot come from the database: the
   session. Everything else in this file is real — the real route module, the
   real guards, the real service, the real Postgres. Mocked by module path so
   guards.ts's own `./index` import resolves to this stub. */
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { cairoToUtc } from "@/lib/datetime";
import { cairoDayWindow } from "./todo";
import { POST as bsPost } from "@/app/api/b-systems/todo/done/route";
import { POST as bfPost } from "@/app/api/byteforce/todo/done/route";

/* SPEC §13 / ADR-062 — the To-Do done ROUTES, at the wall. The service tests
   (todo-done.integration.test.ts) prove the liveness/brand/identity rules on
   an already-guarded caller; this file proves the guard itself, per role, on
   the real handlers: nobody completes a task on a record he cannot see, and
   an anonymous caller learns nothing at all — not even whether a record id
   exists (auth runs BEFORE the record lookup).

   Tasks are dated into the CURRENT Cairo day: the routes call setTodoDone
   without a `now` override, so "today" is the machine's today. */

const window = () => cairoDayWindow(new Date());
/** an instant safely inside today's Cairo window (its first hour) */
const dueToday = () => new Date(window().start.getTime() + 60 * 60 * 1000);

type Role =
  | "bsystems_admin"
  | "bsystems_sales"
  | "bsystems_agent"
  | "bsystems_partner"
  | "byteforce_staff";

let seq = 0;
async function makeUser(name: string, ...roles: Role[]) {
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${seq++}`,
      passwordHash: "x",
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

async function makeLead(opts: {
  name: string;
  brand?: string;
  ownerType?: string;
  ownerUserId?: string | null;
  stage?: string;
}) {
  return db.lead.create({
    data: {
      brand: opts.brand ?? "bsystems",
      name: opts.name,
      number: `010000${seq++}`,
      type: "cold_call",
      stage: opts.stage ?? "following_up",
      ownerType: opts.ownerType ?? "internal",
      ownerUserId: opts.ownerUserId ?? null,
    },
  });
}

const followUpDueToday = (leadId: string) =>
  db.followUp.create({
    data: { leadId, context: "initial", dueAt: dueToday(), method: "call" },
  });

/** Sign in as `user` (or nobody) and POST the body at one of the two routes. */
async function post(
  route: "b-systems" | "byteforce",
  user: { id: string } | null,
  body: unknown,
): Promise<{ status: number; json: { error?: string; ok?: boolean; done?: boolean } }> {
  authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);
  const req = new Request(`http://localhost/api/${route}/todo/done`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await (route === "b-systems" ? bsPost(req) : bfPost(req));
  return { status: res.status, json: (await res.json()) as { error?: string } };
}

beforeEach(async () => {
  authMock.mockReset();
  await resetDb();
});

describe("POST /todo/done — authentication runs before the record lookup", () => {
  it("an anonymous POST is 401 for a REAL record id and for a made-up one alike (no existence oracle)", async () => {
    const lead = await makeLead({ name: "Anon Probe" });
    const f = await followUpDueToday(lead.id);

    const real = await post("b-systems", null, {
      kind: "follow_up",
      recordId: f.id,
      done: true,
    });
    const fake = await post("b-systems", null, {
      kind: "follow_up",
      recordId: "does-not-exist",
      done: true,
    });
    expect(real.status).toBe(401);
    expect(fake.status).toBe(401);
    expect(real.json.error).toBe(fake.json.error); // byte-identical — nothing leaks

    /* the ByteForce twin answers the same way */
    const bf = await post("byteforce", null, { kind: "meeting", recordId: f.id, done: true });
    expect(bf.status).toBe(401);

    expect(await db.todoDone.count()).toBe(0);
  });
});

describe("POST /todo/done — the scope wall, per role", () => {
  it("bsystems_sales completes an INTERNAL-bucket task and is refused an agent-owned one", async () => {
    const sales = await makeUser("Sales Rep", "bsystems_sales");
    const agent = await makeUser("Agent Karim", "bsystems_agent");

    const internal = await makeLead({ name: "Internal Lead" });
    const fInternal = await followUpDueToday(internal.id);
    const agentLead = await makeLead({
      name: "Agent Lead",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    const fAgent = await followUpDueToday(agentLead.id);

    const ok = await post("b-systems", sales, {
      kind: "follow_up",
      recordId: fInternal.id,
      done: true,
    });
    expect(ok.status).toBe(200);
    const mark = await db.todoDone.findUniqueOrThrow({ where: { followUpId: fInternal.id } });
    expect(mark.completedById).toBe(sales.id);
    expect(mark.completedByLabel).toBe("Sales Rep");

    const walled = await post("b-systems", sales, {
      kind: "follow_up",
      recordId: fAgent.id,
      done: true,
    });
    expect(walled.status).toBe(403);
    expect(await db.todoDone.findUnique({ where: { followUpId: fAgent.id } })).toBeNull();
  });

  it("an agent and a partner each reach ONLY their own record — and the wall holds for the UNCHECK too", async () => {
    const agent = await makeUser("Agent Own", "bsystems_agent");
    const partner = await makeUser("Partner Own", "bsystems_partner");

    const agentLead = await makeLead({
      name: "Agent's Own",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    const fAgent = await followUpDueToday(agentLead.id);
    const partnerLead = await makeLead({
      name: "Partner's Own",
      ownerType: "partner",
      ownerUserId: partner.id,
    });
    const fPartner = await followUpDueToday(partnerLead.id);

    expect(
      (await post("b-systems", agent, { kind: "follow_up", recordId: fAgent.id, done: true }))
        .status,
    ).toBe(200);
    expect(
      (await post("b-systems", partner, { kind: "follow_up", recordId: fPartner.id, done: true }))
        .status,
    ).toBe(200);

    /* neither can see the other's lead — check refused... */
    expect(
      (await post("b-systems", partner, { kind: "follow_up", recordId: fAgent.id, done: true }))
        .status,
    ).toBe(403);
    /* ...and UNCHECK refused: the mark on the other man's task survives */
    const strip = await post("b-systems", partner, {
      kind: "follow_up",
      recordId: fAgent.id,
      done: false,
    });
    expect(strip.status).toBe(403);
    expect(await db.todoDone.findUnique({ where: { followUpId: fAgent.id } })).toBeTruthy();

    /* the owner's own uncheck goes through */
    expect(
      (await post("b-systems", agent, { kind: "follow_up", recordId: fAgent.id, done: false }))
        .status,
    ).toBe(200);
    expect(await db.todoDone.findUnique({ where: { followUpId: fAgent.id } })).toBeNull();
  });

  it("the MONEY kinds are admin-only: sales and agent are refused, the admin is not", async () => {
    const admin = await makeUser("The Admin", "bsystems_admin");
    const sales = await makeUser("Sales No Money", "bsystems_sales");
    const agent = await makeUser("Agent No Money", "bsystems_agent");

    const wonLead = await makeLead({ name: "Money Lead", stage: "won" });
    const deal = await db.wonDeal.create({
      data: { leadId: wonLead.id, estimatedValue: 1000, totalCommissionPercent: 1000 },
    });
    const ms = await db.milestone.create({
      data: { wonDealId: deal.id, index: 1, value: 500, expectedEnd: dueToday() },
    });

    for (const caller of [sales, agent]) {
      const res = await post("b-systems", caller, {
        kind: "milestone",
        recordId: ms.id,
        done: true,
      });
      expect(res.status).toBe(403);
    }
    expect(await db.todoDone.count()).toBe(0);

    expect(
      (await post("b-systems", admin, { kind: "milestone", recordId: ms.id, done: true })).status,
    ).toBe(200);
    expect(await db.todoDone.findUnique({ where: { milestoneId: ms.id } })).toBeTruthy();

    /* the ByteForce route has no money kinds at all — the schema refuses them */
    const bf = await makeUser("BF Staff Money", "byteforce_staff");
    const refused = await post("byteforce", bf, {
      kind: "milestone",
      recordId: ms.id,
      done: true,
    });
    expect(refused.status).toBe(400);
  });

  it("BRAND: byteforce_staff owns byteforce leads and is walled off B-Systems ones — and the B-Systems admin off byteforce", async () => {
    const staff = await makeUser("BF Staff", "byteforce_staff");
    const admin = await makeUser("BS Admin", "bsystems_admin");

    const bfLead = await makeLead({ name: "BF Lead", brand: "byteforce" });
    const fBf = await followUpDueToday(bfLead.id);
    const bsLead = await makeLead({ name: "BS Lead" });
    const fBs = await followUpDueToday(bsLead.id);

    expect(
      (await post("byteforce", staff, { kind: "follow_up", recordId: fBf.id, done: true })).status,
    ).toBe(200);

    /* a B-Systems record posted at the BYTEFORCE route: refused at the guard,
       before setTodoDone's own brand 404 is ever reached */
    const crossed = await post("byteforce", staff, {
      kind: "follow_up",
      recordId: fBs.id,
      done: true,
    });
    expect(crossed.status).toBe(403);
    expect(await db.todoDone.findUnique({ where: { followUpId: fBs.id } })).toBeNull();

    /* and the other way: the B-Systems admin has no byteforce_staff role */
    const back = await post("b-systems", admin, {
      kind: "follow_up",
      recordId: fBf.id,
      done: true,
    });
    expect(back.status).toBe(403);
  });

  it("ADR-061 — a prospect-parented record is refused to an authenticated admin (404, no lead to guard)", async () => {
    const admin = await makeUser("Prospect Admin", "bsystems_admin");
    const prospect = await db.partnerProspect.create({
      data: {
        name: "Prospect Person",
        companyName: "Prospect Co",
        number: "0100000099",
        businessActivity: "Consulting",
        stage: "contacted",
      },
    });
    const pf = await db.followUp.create({
      data: {
        partnerProspectId: prospect.id,
        context: "initial",
        dueAt: dueToday(),
        method: "call",
      },
    });
    const res = await post("b-systems", admin, {
      kind: "follow_up",
      recordId: pf.id,
      done: true,
    });
    expect(res.status).toBe(404);
    expect(await db.todoDone.count()).toBe(0);
  });

  it("a deactivated account is refused even on its OWN record (guards re-read active from the DB — ADR-017)", async () => {
    const agent = await makeUser("Suspended Agent", "bsystems_agent");
    const lead = await makeLead({
      name: "Suspended's Lead",
      ownerType: "agent",
      ownerUserId: agent.id,
    });
    const f = await followUpDueToday(lead.id);
    await db.user.update({ where: { id: agent.id }, data: { active: false } });

    const res = await post("b-systems", agent, {
      kind: "follow_up",
      recordId: f.id,
      done: true,
    });
    expect(res.status).toBe(403);
    expect(await db.todoDone.count()).toBe(0);
  });
});

describe("POST /todo/done — the liveness wall reaches the guarded caller too", () => {
  it("even the admin cannot complete a task that is not on today's list", async () => {
    const admin = await makeUser("Liveness Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Future Lead" });
    const future = await db.followUp.create({
      data: {
        leadId: lead.id,
        context: "initial",
        dueAt: cairoToUtc("2099-01-01", "09:00"),
        method: "call",
      },
    });
    const res = await post("b-systems", admin, {
      kind: "follow_up",
      recordId: future.id,
      done: true,
    });
    expect(res.status).toBe(400);
    expect(res.json.error).toMatch(/not on today/);
    expect(await db.todoDone.count()).toBe(0);
  });
});

/* ============================================================================
   ADR-068 — the negotiation response kind at the WALL.

   Founder: "check their response". The row is new; the permission is not. These
   assertions exist to prove exactly that — the same requireLeadAccess wall, the
   same record, and NO new reach for anybody.
   ========================================================================== */
describe("POST /todo/done — the negotiation response kind gains nobody anything", () => {
  const responseDueToday = (leadId: string) =>
    db.followUp.create({
      data: { leadId, context: "after_negotiation", dueAt: dueToday(), method: "call" },
    });

  it("the admin ticks it, and it marks the SAME follow-up row a plain kind would", async () => {
    const admin = await makeUser("Neg Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Neg Wall Co", stage: "negotiation" });
    const f = await responseDueToday(lead.id);

    const res = await post("b-systems", admin, {
      kind: "negotiation_response",
      recordId: f.id,
      done: true,
    });
    expect(res.status).toBe(200);
    const marks = await db.todoDone.findMany();
    expect(marks).toHaveLength(1);
    expect(marks[0]!.followUpId).toBe(f.id);
    expect(marks[0]!.meetingId).toBeNull();
  });

  it("an agent is refused another owner's response row — the wall did not move", async () => {
    const owner = await makeUser("Neg Owner", "bsystems_agent");
    const other = await makeUser("Neg Other", "bsystems_agent");
    const lead = await makeLead({
      name: "Neg Owned Co",
      stage: "negotiation",
      ownerType: "agent",
      ownerUserId: owner.id,
    });
    const f = await responseDueToday(lead.id);

    expect(
      (await post("b-systems", other, { kind: "negotiation_response", recordId: f.id, done: true }))
        .status,
    ).toBe(403);
    expect(
      (await post("b-systems", owner, { kind: "negotiation_response", recordId: f.id, done: true }))
        .status,
    ).toBe(200);
    /* and the uncheck is walled the same way */
    expect(
      (await post("b-systems", other, { kind: "negotiation_response", recordId: f.id, done: false }))
        .status,
    ).toBe(403);
    expect(await db.todoDone.count()).toBe(1);
  });

  it("the ByteForce route refuses the kind outright — that pipeline has no negotiation stage", async () => {
    const staff = await makeUser("Neg BF Staff", "byteforce_staff");
    const lead = await makeLead({ name: "BF Neg Co", brand: "byteforce" });
    const f = await responseDueToday(lead.id);

    /* not a permission refusal — the kind is not in the schema at all, which is
       what makes "ByteForce has no negotiation" a fact the code enforces */
    const res = await post("byteforce", staff, {
      kind: "negotiation_response",
      recordId: f.id,
      done: true,
    });
    expect(res.status).toBe(400);
    expect(await db.todoDone.count()).toBe(0);
  });

  it("a B-Systems admin still cannot reach a ByteForce record through the new kind", async () => {
    const admin = await makeUser("Neg Cross Admin", "bsystems_admin");
    const lead = await makeLead({ name: "Cross Neg Co", brand: "byteforce" });
    const f = await responseDueToday(lead.id);

    const res = await post("b-systems", admin, {
      kind: "negotiation_response",
      recordId: f.id,
      done: true,
    });
    expect(res.status).toBe(403);
    expect(await db.todoDone.count()).toBe(0);
  });
});
