import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { ASSIGNABLE_ROLES, createUser, createUserSchema, listUsers } from "./users";
import { ROLES } from "@/lib/pipeline-engine/constants";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-074 — CREATING AN ACCOUNT, for every role the admin's form offers.

   The founder reported "I can't add any users in bsystems right now" the day a
   new role joined that form's role list, and there was no test on this path at
   all: `createUser` was exercised only incidentally, as a fixture, by two other
   suites. A create form is the one screen where a role list and a Zod enum have
   to agree, and nothing was asserting that they did.

   So this walks the ACTUAL list the form renders — `ASSIGNABLE_ROLES`, the
   service's own constant, which is exactly what the page hands the component —
   pinned against `ROLES` so the two cannot drift apart without a failure that
   names the role.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };

beforeEach(async () => {
  await resetDb();
});

describe("createUser — every role the form offers", () => {
  it("the form's list and the engine's ROLES agree", () => {
    /* the failure this catches: a checkbox the server refuses, or a role the
       server accepts that no admin can ever grant */
    for (const role of ASSIGNABLE_ROLES) expect(ROLES).toContain(role);
    /* and every role in the engine is grantable — a role no administrator can
       assign is a role that can only ever be seeded */
    for (const role of ROLES) {
      expect(ASSIGNABLE_ROLES, `${role} is grantable by no administrator`).toContain(role);
    }
  });

  it.each(ASSIGNABLE_ROLES)("creates an account with %s", async (role) => {
    const input = createUserSchema.parse({
      name: `New ${role}`,
      email: `${role}@example.test`,
      password: "password123",
      roles: [role],
    });
    const created = await createUser(input, actor);
    const stored = await db.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { roles: true },
    });
    expect(stored.roles.map((r) => r.role)).toEqual([role]);
    expect(stored.active).toBe(true);
  });

  it("creates an account holding SEVERAL roles at once", async () => {
    const input = createUserSchema.parse({
      name: "Dual",
      email: "dual@example.test",
      password: "password123",
      roles: ["bsystems_admin", "byteforce_staff"],
    });
    const created = await createUser(input, actor);
    const stored = await db.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { roles: true },
    });
    expect(stored.roles.map((r) => r.role).sort()).toEqual(["bsystems_admin", "byteforce_staff"]);
  });

  it("refuses a role the engine does not know", () => {
    expect(() =>
      createUserSchema.parse({
        name: "Nope",
        email: "nope@example.test",
        password: "password123",
        roles: ["not_a_role"],
      }),
    ).toThrow();
  });

  it("ADR-080 — a RETIRED role cannot be minted at all", () => {
    /* `mindoo_staff` was a real role and is not one any more. The Zod enum is
       built from `ROLES`, so a request naming it is refused at the schema rather
       than reaching `assertGrantable` — which is the right layer: the role does
       not exist, so there is nothing to be ungrantable about. */
    expect(() =>
      createUserSchema.parse({
        name: "Sneaky",
        email: "sneaky@example.test",
        password: "password123",
        roles: ["mindoo_staff"],
      }),
    ).toThrow();
  });

  it("refuses a duplicate email with 409, rather than a crash", async () => {
    const base = {
      name: "First",
      email: "clash@example.test",
      password: "password123",
      roles: ["bsystems_sales"],
    };
    await createUser(createUserSchema.parse(base), actor);
    await expect(
      createUser(createUserSchema.parse({ ...base, name: "Second" }), actor),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("the created account shows up in the admin's list", async () => {
    await createUser(
      createUserSchema.parse({
        name: "Listed",
        email: "listed@example.test",
        password: "password123",
        roles: ["bsystems_sales"],
      }),
      actor,
    );
    const listed = await listUsers();
    expect(listed.map((u) => u.email)).toContain("listed@example.test");
  });
});
