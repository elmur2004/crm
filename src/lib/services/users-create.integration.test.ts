import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { createUser, createUserSchema, listUsers } from "./users";
import { grantableRoles } from "./user-tenancy";
import { ROLES } from "@/lib/pipeline-engine/constants";
import type { Actor } from "./activity";

/* ============================================================================
   ADR-074 — CREATING AN ACCOUNT, for every role the admin's form offers.

   The founder reported "I can't add any users in bsystems right now" the day
   `mindoo_staff` joined that form's role list, and there was no test on this
   path at all: `createUser` was exercised only incidentally, as a fixture, by
   two other suites. A create form is the one screen where a role list and a
   Zod enum have to agree, and nothing was asserting that they did.

   So this walks the ACTUAL list the form renders — imported from nowhere,
   because a component cannot be imported into a Node test; it is repeated here
   deliberately and pinned against `ROLES`, so the two lists cannot drift apart
   without a failure that names the role.
   ========================================================================== */

const actor: Actor = { id: null, label: "Test Admin" };

/* the list src/components/bsystems/users.tsx renders as checkboxes — the
   B-Systems administrator's own, which ADR-075 no longer lets reach Mindoo */
const ASSIGNABLE_ROLES = grantableRoles("bsystems");

beforeEach(async () => {
  await resetDb();
});

describe("createUser — every role the form offers", () => {
  it("the form's list and the engine's ROLES agree", () => {
    /* the failure this catches: a checkbox the server refuses, or a role the
       server accepts that no admin can ever grant */
    for (const role of ASSIGNABLE_ROLES) expect(ROLES).toContain(role);
    /* and every role in the engine is grantable by SOMEBODY — a role no
       administrator can assign is a role that can only ever be seeded */
    for (const role of ROLES) {
      expect(
        [...grantableRoles("bsystems"), ...grantableRoles("mindoo")],
        `${role} is grantable by no administrator`,
      ).toContain(role);
    }
  });

  it.each(ASSIGNABLE_ROLES)("creates an account with %s", async (role) => {
    const input = createUserSchema.parse({
      name: `New ${role}`,
      email: `${role}@example.test`,
      password: "password123",
      roles: [role],
    });
    const created = await createUser(input, "bsystems", actor);
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
    const created = await createUser(input, "bsystems", actor);
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

  it("ADR-075 — a B-Systems admin CANNOT mint a Mindoo account", async () => {
    /* founder: "mindoo user should appear in mindoo system not in bsystems
       systems separate their users." Reading is half of it; this is the other
       half, and it is enforced in the SERVICE so the API and the form both
       inherit it. */
    await expect(
      createUser(
        createUserSchema.parse({
          name: "Sneaky",
          email: "sneaky@example.test",
          password: "password123",
          roles: ["mindoo_staff"],
        }),
        "bsystems",
        actor,
      ),
    ).rejects.toThrow(/cannot assign/i);
  });

  it("ADR-075 — and Mindoo's administrator mints its own, but nothing else", async () => {
    const created = await createUser(
      createUserSchema.parse({
        name: "Mindoo Teammate",
        email: "teammate@mindoo.test",
        password: "password123",
        roles: ["mindoo_staff"],
      }),
      "mindoo",
      actor,
    );
    const stored = await db.user.findUniqueOrThrow({
      where: { id: created.id },
      include: { roles: true },
    });
    expect(stored.roles.map((r) => r.role)).toEqual(["mindoo_staff"]);

    await expect(
      createUser(
        createUserSchema.parse({
          name: "Crossing",
          email: "crossing@mindoo.test",
          password: "password123",
          roles: ["bsystems_admin"],
        }),
        "mindoo",
        actor,
      ),
    ).rejects.toThrow(/cannot assign/i);
  });

  it("ADR-075 — the two lists never see each other's people", async () => {
    await createUser(
      createUserSchema.parse({
        name: "BS person",
        email: "bs@example.test",
        password: "password123",
        roles: ["bsystems_sales"],
      }),
      "bsystems",
      actor,
    );
    await createUser(
      createUserSchema.parse({
        name: "MD person",
        email: "md@example.test",
        password: "password123",
        roles: ["mindoo_staff"],
      }),
      "mindoo",
      actor,
    );
    expect((await listUsers("bsystems")).map((u) => u.email)).toEqual(["bs@example.test"]);
    expect((await listUsers("mindoo")).map((u) => u.email)).toEqual(["md@example.test"]);
  });

  it("refuses a duplicate email with 409, rather than a crash", async () => {
    const base = {
      name: "First",
      email: "clash@example.test",
      password: "password123",
      roles: ["bsystems_sales"],
    };
    await createUser(createUserSchema.parse(base), "bsystems", actor);
    await expect(
      createUser(createUserSchema.parse({ ...base, name: "Second" }), "bsystems", actor),
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
      "bsystems",
      actor,
    );
    const listed = await listUsers("bsystems");
    expect(listed.map((u) => u.email)).toContain("listed@example.test");
  });
});
