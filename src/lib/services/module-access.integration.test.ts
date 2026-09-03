import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   ADR-066 — PER-ADMIN module access.

   Founder: "I want to have the ability to block some admins from acsessing
   accounting or data vault."

   This is a permission feature, so the tests ARE the deliverable. The ONE piece
   of the request that cannot come from the database is the session; everything
   else here is real — the real route modules, the real guards, the real
   Postgres. Mocked by module path so guards.ts's own `./index` import resolves
   to this stub (the pattern todo-done-routes.integration.test.ts established).
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<
    () => Promise<{ user?: { id: string; impersonatorId?: string } } | null>
  >(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { canUseModule } from "@/lib/auth/roles";
import { createUser, updateUser } from "./users";
import { GET as accountingExport } from "@/app/api/accounting/export/route";
import { GET as vaultSearch } from "@/app/api/vault/search/route";

type Role =
  | "bsystems_admin"
  | "bsystems_sales"
  | "bsystems_agent"
  | "bsystems_partner"
  | "bsystems_data_entry"
  | "byteforce_staff";

let seq = 0;
async function makeUser(
  name: string,
  roles: Role[],
  flags?: { canAccessAccounting?: boolean; canAccessVault?: boolean },
) {
  return db.user.create({
    data: {
      name,
      phone: `+2010666000${seq++}`,
      passwordHash: "x",
      ...flags,
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

/** Sign in as `user` (optionally while being impersonated) and call a module
    route for real. Returns the status the guard produced. */
async function call(
  module: "accounting" | "vault",
  user: { id: string } | null,
  opts?: { impersonatorId?: string },
): Promise<{ status: number; body: { error?: string } }> {
  authMock.mockResolvedValue(
    user ? { user: { id: user.id, ...(opts?.impersonatorId && { impersonatorId: opts.impersonatorId }) } } : null,
  );
  const res =
    module === "accounting"
      ? await accountingExport(
          new Request("http://localhost/api/accounting/export?company=bsystems"),
        )
      : await vaultSearch(new Request("http://localhost/api/vault/search?q=x"));
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return { status: res.status, body };
}

const actor = { id: null as string | null, label: "Elmur" };

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

/* -------------------------------------------------------------------------- */

describe("the module wall — an allowed admin passes, a blocked one does not", () => {
  it("ACCOUNTING: the flag is the whole difference between 200 and 403", async () => {
    const allowed = await makeUser("Allowed", ["bsystems_admin"]);
    const blocked = await makeUser("Blocked", ["bsystems_admin"], {
      canAccessAccounting: false,
    });

    expect((await call("accounting", allowed)).status).toBe(200);

    const refused = await call("accounting", blocked);
    expect(refused.status).toBe(403);
    /* the refusal NAMES what was refused — never a generic "no access" */
    expect(refused.body.error).toContain("Accounting");

    /* and taking Accounting away leaves the Data Vault exactly where it was */
    expect((await call("vault", blocked)).status).toBe(200);
  });

  it("DATA VAULT: the same, independently — one module, not both", async () => {
    const allowed = await makeUser("Allowed", ["bsystems_admin"]);
    const blocked = await makeUser("Blocked", ["bsystems_admin"], { canAccessVault: false });

    expect((await call("vault", allowed)).status).toBe(200);

    const refused = await call("vault", blocked);
    expect(refused.status).toBe(403);
    expect(refused.body.error).toContain("Data Vault");

    expect((await call("accounting", blocked)).status).toBe(200);
  });

  it("an account created before the flags existed keeps BOTH modules", async () => {
    /* the migration's promise, expressed against the column default: a row
       written with no opinion about the flags is a row that can do everything
       it could yesterday */
    const legacy = await makeUser("Legacy admin", ["bsystems_admin"]);
    expect(legacy.canAccessAccounting).toBe(true);
    expect(legacy.canAccessVault).toBe(true);
    expect((await call("accounting", legacy)).status).toBe(200);
    expect((await call("vault", legacy)).status).toBe(200);
  });

  it("an anonymous caller is refused at 401, before any flag is consulted", async () => {
    expect((await call("accounting", null)).status).toBe(401);
    expect((await call("vault", null)).status).toBe(401);
  });
});

/* -------------------------------------------------------------------------- */

describe("the wall is the DATABASE ROW, not the token", () => {
  it("revoking the flag bites on the VERY NEXT call — no re-login", async () => {
    const admin = await makeUser("Still signed in", ["bsystems_admin"]);
    /* the session is minted ONCE and never touched again for the rest of this
       test — exactly the situation a signed-in admin is in */
    expect((await call("accounting", admin)).status).toBe(200);

    await db.user.update({ where: { id: admin.id }, data: { canAccessAccounting: false } });

    /* same session, same token, next request */
    expect((await call("accounting", admin)).status).toBe(403);

    /* and giving it back is just as immediate */
    await db.user.update({ where: { id: admin.id }, data: { canAccessAccounting: true } });
    expect((await call("accounting", admin)).status).toBe(200);
  });

  it("the vault flag behaves identically on a live session", async () => {
    const admin = await makeUser("Live", ["bsystems_admin"]);
    expect((await call("vault", admin)).status).toBe(200);
    await db.user.update({ where: { id: admin.id }, data: { canAccessVault: false } });
    expect((await call("vault", admin)).status).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */

describe("the flag NARROWS bsystems_admin — it can never grant", () => {
  it("a non-admin gains nothing from a true flag, on either module", async () => {
    /* true is the column DEFAULT, so every non-admin in the table carries it.
       That must remain completely inert. */
    for (const role of [
      "bsystems_sales",
      "bsystems_agent",
      "bsystems_partner",
      "bsystems_data_entry",
      "byteforce_staff",
    ] as Role[]) {
      const user = await makeUser(`A ${role}`, [role], {
        canAccessAccounting: true,
        canAccessVault: true,
      });
      expect(user.canAccessAccounting).toBe(true);
      expect(user.canAccessVault).toBe(true);

      const acct = await call("accounting", user);
      expect(acct.status, `${role} must not reach Accounting`).toBe(403);
      const vault = await call("vault", user);
      expect(vault.status, `${role} must not reach the Data Vault`).toBe(403);
      /* refused on the ROLE, not on the module — the message proves which
         wall stopped them, so a future refactor cannot quietly swap the order */
      expect(acct.body.error).toBe("You do not have access to this area");
      expect(vault.body.error).toBe("You do not have access to this area");
    }
  });

  it("the predicate itself says so, with no database in the way", () => {
    const flags = { canAccessAccounting: true, canAccessVault: true };
    expect(canUseModule({ roles: ["bsystems_sales"], ...flags }, "accounting")).toBe(false);
    expect(canUseModule({ roles: ["byteforce_staff"], ...flags }, "vault")).toBe(false);
    expect(canUseModule({ roles: [], ...flags }, "accounting")).toBe(false);
    expect(canUseModule({ roles: ["bsystems_admin"], ...flags }, "accounting")).toBe(true);
    expect(
      canUseModule(
        { roles: ["bsystems_admin"], canAccessAccounting: false, canAccessVault: true },
        "accounting",
      ),
    ).toBe(false);
    /* an admin who ALSO holds another role is still an admin (the ADR-051
       lesson): the flag decides, the extra role changes nothing */
    expect(
      canUseModule(
        { roles: ["bsystems_admin", "byteforce_staff"], ...flags, canAccessVault: false },
        "vault",
      ),
    ).toBe(false);
  });
});

/* -------------------------------------------------------------------------- */

describe("no self-lockout", () => {
  it("an admin cannot take Accounting or the Vault from his OWN account", async () => {
    const me = await createUser(
      { name: "Elmur", email: "self@example.com", password: "password123", roles: ["bsystems_admin"] },
      "bsystems",
      actor,
    );
    const asMyself = { id: me.id, label: me.name };

    await expect(
      updateUser(me.id, { canAccessAccounting: false }, "bsystems", asMyself),
    ).rejects.toThrow(/your own access to Accounting/i);
    await expect(updateUser(me.id, { canAccessVault: false }, "bsystems", asMyself)).rejects.toThrow(
      /your own access to the Data Vault/i,
    );

    /* nothing was written — he can still walk back into what he is configuring */
    const after = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    expect(after.canAccessAccounting).toBe(true);
    expect(after.canAccessVault).toBe(true);
    expect((await call("accounting", me)).status).toBe(200);
    expect((await call("vault", me)).status).toBe(200);
  });

  it("but ANOTHER admin may take it from him, and may give it back", async () => {
    const target = await createUser(
      { name: "Nour", email: "nour@example.com", password: "password123", roles: ["bsystems_admin"] },
      "bsystems",
      actor,
    );
    const other = await createUser(
      { name: "Other", email: "other@example.com", password: "password123", roles: ["bsystems_admin"] },
      "bsystems",
      actor,
    );
    const asOther = { id: other.id, label: other.name };

    await updateUser(target.id, { canAccessVault: false }, "bsystems", asOther);
    expect((await call("vault", target)).status).toBe(403);
    /* the other admin's own access is untouched */
    expect((await call("vault", other)).status).toBe(200);

    await updateUser(target.id, { canAccessVault: true }, "bsystems", asOther);
    expect((await call("vault", target)).status).toBe(200);
  });

  it("granting yourself a module you already hold is not a lockout, so it passes", async () => {
    /* the rule refuses REVOCATION only — a no-op save from the edit modal (which
       always posts both flags for an admin) must not start failing */
    const me = await createUser(
      { name: "Elmur", email: "noop@example.com", password: "password123", roles: ["bsystems_admin"] },
      "bsystems",
      actor,
    );
    await expect(
      updateUser(me.id, { canAccessAccounting: true, canAccessVault: true }, "bsystems", { id: me.id, label: me.name }),
    ).resolves.toBeTruthy();
  });

  it("a new admin is born holding both modules; one can be withheld at creation", async () => {
    const full = await createUser(
      { name: "Full", email: "full@example.com", password: "password123", roles: ["bsystems_admin"] },
      "bsystems",
      actor,
    );
    expect(full.canAccessAccounting).toBe(true);
    expect(full.canAccessVault).toBe(true);

    const partial = await createUser(
      {
        name: "Partial",
        email: "partial@example.com",
        password: "password123",
        roles: ["bsystems_admin"],
        canAccessVault: false,
      },
      "bsystems",
      actor,
    );
    expect(partial.canAccessAccounting).toBe(true);
    expect(partial.canAccessVault).toBe(false);
    expect((await call("vault", partial)).status).toBe(403);
    expect((await call("accounting", partial)).status).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */

describe("impersonation honours the IMPERSONATED user's flags", () => {
  it("an unblocked admin acting AS a blocked admin is refused", async () => {
    const impersonator = await makeUser("Full admin", ["bsystems_admin"]); // both modules
    const blocked = await makeUser("Blocked admin", ["bsystems_admin"], {
      canAccessAccounting: false,
      canAccessVault: false,
    });

    /* the impersonation session carries the TARGET as `user.id`; impersonatorId
       only remembers who to snap back to. The guard must read the target's row. */
    const acct = await call("accounting", blocked, { impersonatorId: impersonator.id });
    expect(acct.status).toBe(403);
    expect((await call("vault", blocked, { impersonatorId: impersonator.id })).status).toBe(403);

    /* and the impersonator's own session is unaffected — snapping back works */
    expect((await call("accounting", impersonator)).status).toBe(200);
  });

  it("a BLOCKED admin acting as an unblocked one gets the target's access, not his own", async () => {
    const impersonator = await makeUser("Blocked everywhere", ["bsystems_admin"], {
      canAccessAccounting: false,
      canAccessVault: false,
    });
    const target = await makeUser("Full admin", ["bsystems_admin"]);

    /* the flags travel with the ACCOUNT being acted as, in both directions —
       which is the honest reading of "you are that person right now" */
    expect((await call("accounting", target, { impersonatorId: impersonator.id })).status).toBe(200);
    expect((await call("vault", target, { impersonatorId: impersonator.id })).status).toBe(200);

    /* his own session is still refused */
    expect((await call("accounting", impersonator)).status).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */

/* The hole this feature could ship with: FORTY route files, and one that keeps
   the old guard is a silent bypass — the module UI is not the security boundary.
   So the directory itself is the assertion, and a route added tomorrow cannot
   miss the wall without turning this red. */
describe("every module route is behind the module guard", () => {
  const routeFiles = (dir: string): string[] => {
    const out: string[] = [];
    const walk = (d: string) => {
      for (const entry of readdirSync(d)) {
        const p = path.join(d, entry);
        if (statSync(p).isDirectory()) walk(p);
        else if (entry === "route.ts") out.push(p);
      }
    };
    walk(path.resolve(process.cwd(), dir));
    return out.sort();
  };

  const cases: Array<[string, string, string]> = [
    ["accounting", "src/app/api/accounting", "requireAccounting"],
    ["vault", "src/app/api/vault", "requireVault"],
  ];

  for (const [label, dir, guard] of cases) {
    it(`/api/${label}: every route.ts calls ${guard}() and none calls requireBsAdmin`, () => {
      const files = routeFiles(dir);
      expect(files.length).toBeGreaterThan(0);
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        const rel = path.relative(process.cwd(), file);
        expect(src, `${rel} must call ${guard}()`).toContain(`${guard}()`);
        /* the old wall is admin-only and knows nothing about the flags —
           anywhere under these two namespaces it is now a hole */
        expect(src, `${rel} must NOT use requireBsAdmin`).not.toMatch(/\brequireBsAdmin\b/);
      }
    });
  }

  it("the two namespaces still hold the forty routes the audit counted", () => {
    /* a floor, not a fixture: routes may be ADDED (the per-file assertion above
       then covers them), but a drop would mean a namespace moved somewhere this
       scan no longer reads */
    const total = routeFiles("src/app/api/accounting").length + routeFiles("src/app/api/vault").length;
    expect(total).toBeGreaterThanOrEqual(40);
  });

  it("every PAGE under the two module route groups uses the module page guard", () => {
    const pageFiles = (dir: string): string[] => {
      const out: string[] = [];
      const walk = (d: string) => {
        for (const entry of readdirSync(d)) {
          const p = path.join(d, entry);
          if (statSync(p).isDirectory()) walk(p);
          else if (entry === "page.tsx" || entry === "layout.tsx") out.push(p);
        }
      };
      walk(path.resolve(process.cwd(), dir));
      return out.sort();
    };
    for (const [dir, guard] of [
      ["src/app/(accounting)", "requireAccountingPage"],
      ["src/app/(vault)", "requireVaultPage"],
    ] as const) {
      for (const file of pageFiles(dir)) {
        const src = readFileSync(file, "utf8");
        const rel = path.relative(process.cwd(), file);
        /* the route-group <html> shells hold no guard and never did */
        if (!/require[A-Za-z]*Page\b/.test(src)) continue;
        expect(src, `${rel} must use ${guard}`).toContain(guard);
        expect(src, `${rel} must NOT use requireBsAdminPage`).not.toMatch(
          /\brequireBsAdminPage\b/,
        );
      }
    }
  });
});
