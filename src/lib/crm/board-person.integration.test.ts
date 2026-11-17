import { beforeEach, describe, expect, it, vi } from "vitest";

/* the request's cookies, as the board and the action see them */
const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  writes: [] as Array<{ name: string; value: string; opts: Record<string, unknown> }>,
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { value: jar.values.get(name)! } : undefined),
    set: (name: string, value: string, opts: Record<string, unknown>) => {
      jar.writes.push({ name, value, opts });
      jar.values.set(name, value);
    },
  }),
}));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import type { Role } from "@/lib/pipeline-engine/constants";
import { bsLeadsWhere, countBsLeads, listBsLeads } from "@/lib/services/bsystems-admin";
import { byteforceBoardWhere } from "./search-hop";
import { BOARD_PERSON_COOKIE, boardPersonWhere, HOP_MARKER_PARAM } from "./board-person";
import { boardPersonNarrowing, boardPersonNoMatches, boardPersonView } from "./board-person-menu";
import { SWITCHED_PARAM } from "./search-hop";
import { setBoardPerson } from "./board-person-actions";

/* ADR-109 — founder (2026-11-17): "a button on top of the CRMs, both CRMs …
   just visible for the admin … either mine or either this person or this
   person". What the switch offers, with real rows, and what it narrows. */

let seq = 0;
async function makeUser(name: string, roles: Role[], extra: Record<string, unknown> = {}) {
  return db.user.create({
    data: {
      name,
      phone: `+2010888000${seq++}`,
      passwordHash: "x",
      roles: { create: roles.map((role) => ({ role })) },
      ...extra,
    },
    include: { roles: true },
  });
}
const viewerOf = (u: { id: string; roles: Array<{ role: string }> }) => ({
  id: u.id,
  roles: u.roles.map((r) => r.role as Role),
});
async function makeLead(
  name: string,
  brand: "bsystems" | "byteforce",
  extra: { ownerUserId?: string | null; ownerType?: string; stage?: string; archived?: boolean } = {},
) {
  return db.lead.create({
    data: {
      brand,
      name,
      number: `0102${String(seq++).padStart(7, "0")}`,
      type: "cold_call",
      ownerType: extra.ownerType ?? "internal",
      ownerUserId: extra.ownerUserId ?? null,
      stage: extra.stage ?? "new",
      archived: extra.archived ?? false,
      companyName: brand === "bsystems" ? `${name} Ltd` : null,
    },
  });
}

beforeEach(async () => {
  await resetDb();
  jar.values.clear();
  jar.writes.length = 0;
});

describe("what the B-Systems switch offers", () => {
  it("Everyone, Mine and Unassigned with their counts, then the roster and anyone still holding a lead, by name", async () => {
    const admin = await makeUser("Admin Person", ["bsystems_admin"]);
    const agent = await makeUser("Zeina Agent", ["bsystems_agent"]);
    const sales = await makeUser("Bassem Sales", ["bsystems_sales"]);
    /* removed, but still holding a lead the admin must be able to find */
    const leaver = await makeUser("Laila Leaver", ["bsystems_agent"], { active: false });
    /* a ByteForce-only account is not B-Systems' to offer */
    await makeUser("Bf Only", ["byteforce_staff"]);

    await makeLead("A1", "bsystems", { ownerUserId: agent.id, ownerType: "agent" });
    await makeLead("A2", "bsystems", { ownerUserId: agent.id, ownerType: "agent" });
    await makeLead("M1", "bsystems", { ownerUserId: admin.id, ownerType: "admin" });
    await makeLead("L1", "bsystems", { ownerUserId: leaver.id, ownerType: "agent" });
    await makeLead("U1", "bsystems");
    await makeLead("U2", "bsystems");
    /* none of these count: archived, and the other company */
    await makeLead("Archived", "bsystems", { ownerUserId: agent.id, archived: true });
    await makeLead("Other company", "byteforce", { ownerUserId: agent.id });

    const view = (await boardPersonView({
      company: "bsystems",
      viewer: viewerOf(admin),
      boardWhere: bsLeadsWhere("bsystems", "any", {}),
      switched: undefined,
      locale: "en",
    }))!;
    expect(view.person).toEqual({ kind: "all" });
    expect(view.value).toBe("all");
    expect(view.fixed.map((o) => [o.value, o.label])).toEqual([
      ["all", "Everyone (6)"],
      ["mine", "Mine (1)"],
      ["unassigned", "Unassigned (2)"],
    ]);
    expect(view.people.map((o) => [o.value, o.label])).toEqual([
      [`user:${sales.id}`, "Bassem Sales — Internal sales (0)"],
      [`user:${leaver.id}`, "Laila Leaver — removed (1)"],
      [`user:${agent.id}`, "Zeina Agent — Agent (2)"],
    ]);
  });

  it("applies a remembered person, and narrows the board to exactly that person's cards", async () => {
    const admin = await makeUser("Admin Person", ["bsystems_admin"]);
    const agent = await makeUser("Zeina Agent", ["bsystems_agent"]);
    await makeLead("Hers", "bsystems", { ownerUserId: agent.id, ownerType: "agent" });
    await makeLead("Mine", "bsystems", { ownerUserId: admin.id, ownerType: "admin" });
    await makeLead("Nobody's", "bsystems");

    jar.values.set(BOARD_PERSON_COOKIE.bsystems, `user:${agent.id}`);
    const view = (await boardPersonView({
      company: "bsystems",
      viewer: viewerOf(admin),
      boardWhere: bsLeadsWhere("bsystems", "any", {}),
      switched: undefined,
      locale: "en",
    }))!;
    expect(view.person).toEqual({ kind: "user", userId: agent.id });
    expect(view.personName).toBe("Zeina Agent");
    const names = async (where: ReturnType<typeof boardPersonWhere>) =>
      (await listBsLeads("bsystems", "any", {}, where)).map((l) => l.name).sort();
    expect(await names(boardPersonWhere(view.person, admin.id))).toEqual(["Hers"]);
    expect(await names(boardPersonWhere({ kind: "mine" }, admin.id))).toEqual(["Mine"]);
    expect(await names(boardPersonWhere({ kind: "unassigned" }, admin.id))).toEqual(["Nobody's"]);
    expect(await names(boardPersonWhere({ kind: "all" }, admin.id))).toEqual(["Hers", "Mine", "Nobody's"]);
    expect(boardPersonNarrowing(view, admin.id)).toEqual({ ownerUserId: agent.id });
  });

  it("an empty search blames the switch only when everyone's leads would have matched", async () => {
    const admin = await makeUser("Admin Person", ["bsystems_admin"]);
    const agent = await makeUser("Zeina Agent", ["bsystems_agent"]);
    await makeLead("Findable Loose", "bsystems");
    jar.values.set(BOARD_PERSON_COOKIE.bsystems, `user:${agent.id}`);
    const view = (await boardPersonView({
      company: "bsystems",
      viewer: viewerOf(admin),
      boardWhere: bsLeadsWhere("bsystems", "any", {}),
      switched: undefined,
      locale: "en",
    }))!;
    /* her board has none; everyone's has one */
    const narrowed = await listBsLeads("bsystems", "any", { search: "Findable" }, boardPersonNarrowing(view, admin.id));
    expect(narrowed).toEqual([]);
    const everyone = await countBsLeads("bsystems", "any", { search: "Findable" });
    expect(everyone).toBe(1);
    expect(boardPersonNoMatches(view, everyone, "en")).toBe("None of Zeina Agent's leads match these filters.");
    /* nobody's leads match: the board's own "No leads match" is the truth */
    expect(await countBsLeads("bsystems", "any", { search: "Nothing like this" })).toBe(0);
    expect(boardPersonNoMatches(view, 0, "en")).toBeNull();
    /* the other two sentences, and none on Everyone */
    jar.values.set(BOARD_PERSON_COOKIE.bsystems, "mine");
    const mine = (await boardPersonView({
      company: "bsystems",
      viewer: viewerOf(admin),
      boardWhere: bsLeadsWhere("bsystems", "any", {}),
      switched: undefined,
      locale: "en",
    }))!;
    expect(boardPersonNoMatches(mine, 1, "en")).toBe("None of your leads match these filters.");
    jar.values.set(BOARD_PERSON_COOKIE.bsystems, "all");
    const all = (await boardPersonView({
      company: "bsystems",
      viewer: viewerOf(admin),
      boardWhere: bsLeadsWhere("bsystems", "any", {}),
      switched: undefined,
      locale: "en",
    }))!;
    expect(boardPersonNoMatches(all, 1, "en")).toBeNull();
    expect(boardPersonNarrowing(all, admin.id)).toBeUndefined();
  });

  it("the narrowing never widens: under an AND it cannot replace an owner the predicate already set", async () => {
    const agent = await makeUser("Zeina Agent", ["bsystems_agent"]);
    const other = await makeUser("Omar Agent", ["bsystems_agent"]);
    await makeLead("Zeina's", "bsystems", { ownerUserId: agent.id, ownerType: "agent" });
    await makeLead("Omar's", "bsystems", { ownerUserId: other.id, ownerType: "agent" });
    /* an owner-bucket filter and a person who is not in it: nothing, not Omar's */
    const rows = await listBsLeads(
      "bsystems",
      "unassigned",
      {},
      boardPersonWhere({ kind: "user", userId: other.id }, agent.id),
    );
    expect(rows).toEqual([]);
  });

  it("a remembered person who is no longer on offer is Everyone; the admin chosen by id is Mine; a hop's arrival is Everyone", async () => {
    const admin = await makeUser("Admin Person", ["bsystems_admin"]);
    const agent = await makeUser("Zeina Agent", ["bsystems_agent"]);
    const view = (switched?: string) =>
      boardPersonView({
        company: "bsystems",
        viewer: viewerOf(admin),
        boardWhere: bsLeadsWhere("bsystems", "any", {}),
        switched,
        locale: "en",
      });

    jar.values.set(BOARD_PERSON_COOKIE.bsystems, "user:no-such-person");
    expect((await view())!.person).toEqual({ kind: "all" });

    jar.values.set(BOARD_PERSON_COOKIE.bsystems, `user:${admin.id}`);
    expect((await view())!.person).toEqual({ kind: "mine" });

    jar.values.set(BOARD_PERSON_COOKIE.bsystems, `user:${agent.id}`);
    /* arrived from ByteForce by a search hop: everyone */
    expect((await view("byteforce"))!.person).toEqual({ kind: "all" });
    /* the notice's way back marks the board it returns to: his choice */
    expect((await view("bsystems"))!.person).toEqual({ kind: "user", userId: agent.id });
    expect((await view())!.person).toEqual({ kind: "user", userId: agent.id });
  });
});

describe("nobody but the company admin gets a switch", () => {
  it("answers null — no roster, no counts — to every other account, whatever the cookie says", async () => {
    const sales = await makeUser("Bs Sales", ["bsystems_sales"]);
    const agent = await makeUser("Bs Agent", ["bsystems_agent"]);
    const staff = await makeUser("Bf Staff", ["byteforce_staff"]);
    /* a B-Systems admin who is not ByteForce staff is not the ByteForce admin */
    const bsAdminOnly = await makeUser("Bs Admin Only", ["bsystems_admin"]);
    /* ByteForce staff who is not a B-Systems admin is not the ByteForce admin */
    const dual = await makeUser("Dual Seller", ["bsystems_sales", "byteforce_staff"]);
    jar.values.set(BOARD_PERSON_COOKIE.bsystems, "unassigned");
    jar.values.set(BOARD_PERSON_COOKIE.byteforce, "unassigned");
    const ask = (company: "bsystems" | "byteforce", u: Parameters<typeof viewerOf>[0]) =>
      boardPersonView({
        company,
        viewer: viewerOf(u),
        boardWhere:
          company === "bsystems" ? bsLeadsWhere("bsystems", "any", {}) : byteforceBoardWhere({}, { kind: "all" }),
        switched: undefined,
        locale: "en",
      });
    expect(await ask("bsystems", sales)).toBeNull();
    expect(await ask("bsystems", agent)).toBeNull();
    expect(await ask("bsystems", dual)).toBeNull();
    expect(await ask("byteforce", staff)).toBeNull();
    expect(await ask("byteforce", bsAdminOnly)).toBeNull();
    expect(await ask("byteforce", dual)).toBeNull();
    expect(boardPersonNarrowing(null, sales.id)).toBeUndefined();
  });

  it("the client's hop marker is the hop's own parameter", () => {
    expect(HOP_MARKER_PARAM).toBe(SWITCHED_PARAM);
  });
});

describe("the ByteForce switch", () => {
  it("offers the staff accounts and reads its own company's choice, not B-Systems'", async () => {
    const admin = await makeUser("Admin Person", ["byteforce_staff", "bsystems_admin"]);
    const staff = await makeUser("Sara Staff", ["byteforce_staff"]);
    await makeUser("Bs Agent", ["bsystems_agent"]);
    await makeLead("Sara's", "byteforce", { ownerUserId: staff.id });
    await makeLead("Loose", "byteforce");

    /* the B-Systems board's choice does not leak into ByteForce's */
    jar.values.set(BOARD_PERSON_COOKIE.bsystems, "unassigned");
    const view = (await boardPersonView({
      company: "byteforce",
      viewer: viewerOf(admin),
      boardWhere: byteforceBoardWhere({}, { kind: "all" }),
      switched: undefined,
      locale: "en",
    }))!;
    expect(view.person).toEqual({ kind: "all" });
    expect(view.fixed.map((o) => o.label)).toEqual(["Everyone (2)", "Mine (0)", "Unassigned (1)"]);
    expect(view.people.map((o) => o.label)).toEqual(["Sara Staff (1)"]);
  });

  it("speaks Arabic", async () => {
    const admin = await makeUser("Admin Person", ["byteforce_staff", "bsystems_admin"]);
    const view = (await boardPersonView({
      company: "byteforce",
      viewer: viewerOf(admin),
      boardWhere: byteforceBoardWhere({}, { kind: "all" }),
      switched: undefined,
      locale: "ar",
    }))!;
    expect(view.fixed.map((o) => o.label)).toEqual(["الجميع (0)", "الخاصة بي (0)", "غير مُسند (0)"]);
  });
});

describe("the action that remembers the choice", () => {
  it("writes the company's own cookie, httpOnly, for a year", async () => {
    await setBoardPerson("byteforce", "mine");
    expect(jar.writes).toEqual([
      {
        name: BOARD_PERSON_COOKIE.byteforce,
        value: "mine",
        opts: { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", httpOnly: true },
      },
    ]);
  });

  it("stores anything it does not recognise as Everyone, and writes nothing for an unknown company", async () => {
    await setBoardPerson("bsystems", "<script>");
    await setBoardPerson("mindoo", "mine");
    expect(jar.writes.map((w) => [w.name, w.value])).toEqual([[BOARD_PERSON_COOKIE.bsystems, "all"]]);
  });
});
