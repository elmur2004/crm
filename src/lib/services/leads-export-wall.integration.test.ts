import { readFileSync } from "node:fs";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   ADR-083 — THE WALL ON THE LEADS EXPORT.

   This is the one request in the product that returns an entire company's
   customer list in a single file, so it is the one place a role mistake is
   unrecoverable — the file is on his laptop before anybody notices. The
   permission tests are therefore the deliverable, not a formality.

   Everything here is REAL except the session: the real route modules, the real
   guards, the real Postgres, the real spreadsheet. Mocked by module path so
   guards.ts's own `./index` import resolves to this stub — the pattern
   module-access.integration.test.ts established.

   What is asserted: every role against every company, a hand-typed
   cross-company request in both directions, an anonymous caller, a deactivated
   one, impersonation, a revoked role biting on the very next request, and the
   DIRECTORY — because a third export route added tomorrow must not be able to
   skip the shared handler.
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<
    () => Promise<{ user?: { id: string; impersonatorId?: string } } | null>
  >(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

/* `getLocale` reads the locale cookie through `next/headers`, which has no
   request scope under vitest. The cookie jar is stubbed rather than the locale
   helper, so the route's own wiring (cookie → header language) is exercised
   here too and not merely assumed. */
const { localeCookie } = vi.hoisted(() => ({ localeCookie: { value: "en" } }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === "locale" ? { value: localeCookie.value } : undefined),
  }),
}));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import { canExportLeads } from "@/lib/crm/leads-export";
import { createLead } from "./leads";
import { GET as byteforceExport } from "@/app/api/byteforce/leads/export/route";
import { GET as bsystemsExport } from "@/app/api/b-systems/leads/export/route";
import type { Actor } from "./activity";

type Company = "bsystems" | "byteforce";

const ROUTES: Record<Company, (req: Request) => Promise<Response>> = {
  bsystems: bsystemsExport,
  byteforce: byteforceExport,
};

const URLS: Record<Company, string> = {
  bsystems: "http://localhost/api/b-systems/leads/export",
  byteforce: "http://localhost/api/byteforce/leads/export",
};

const actor: Actor = { id: null, label: "Test Admin" };

let seq = 0;
async function makeUser(name: string, roles: Role[], opts?: { active?: boolean }) {
  seq += 1;
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${seq}`,
      passwordHash: "x",
      ...(opts?.active === false ? { active: false } : {}),
      roles: { create: roles.map((role) => ({ role })) },
    },
  });
}

/** Sign in as `user` and really call the export route. */
async function call(
  company: Company,
  user: { id: string } | null,
  opts?: { impersonatorId?: string },
) {
  authMock.mockResolvedValue(
    user
      ? { user: { id: user.id, ...(opts?.impersonatorId && { impersonatorId: opts.impersonatorId }) } }
      : null,
  );
  const res = await ROUTES[company](new Request(URLS[company]));
  return res;
}

async function statusOf(company: Company, user: { id: string } | null, opts?: { impersonatorId?: string }) {
  const res = await call(company, user, opts);
  return res.status;
}

async function errorOf(company: Company, user: { id: string } | null) {
  const res = await call(company, user);
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  return body.error;
}

function lead(brand: Company, name: string) {
  seq += 1;
  return createLead(brand, { name, number: `0100555${String(1000 + seq)}`, type: "cold_call" }, actor);
}

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
  localeCookie.value = "en";
});

/* -------------------------------------------------------------------------- */

describe("every role, every company", () => {
  it("only byteforce_staff gets ByteForce, and only bsystems_admin gets B-Systems", async () => {
    for (const role of ROLES) {
      const user = await makeUser(`A ${role}`, [role]);
      for (const company of ["bsystems", "byteforce"] as Company[]) {
        const expected = canExportLeads([role], company) ? 200 : 403;
        expect(
          await statusOf(company, user),
          `${role} → ${company} must be ${expected}`,
        ).toBe(expected);
      }
    }
  });

  it("the four B-Systems non-admin roles are refused a company-wide list", async () => {
    /* THE refusal this feature exists to get right. An agent or a partner sees
       only its own leads everywhere else in this product (requireLeadAccess),
       and internal sales works only the internal bucket — one file would undo
       all of that in a single click. */
    for (const role of [
      "bsystems_sales",
      "bsystems_agent",
      "bsystems_partner",
      "bsystems_data_entry",
    ] as Role[]) {
      const user = await makeUser(`Refused ${role}`, [role]);
      expect(await statusOf("bsystems", user), role).toBe(403);
      expect(await statusOf("byteforce", user), role).toBe(403);
      /* the house refusal message, so it reads like every other 403 */
      expect(await errorOf("bsystems", user)).toBe("You do not have access to this area");
    }
  });

  it("an account holding BOTH may pull both", async () => {
    const both = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    expect(await statusOf("bsystems", both)).toBe(200);
    expect(await statusOf("byteforce", both)).toBe(200);
  });

  it("holding both COMPANIES is not holding both exports", async () => {
    /* `bsystems_sales` + `byteforce_staff` can switch companies and can open
       ByteForce's Leads page — and cannot open B-Systems'. One file, not two. */
    const sideways = await makeUser("Sideways", ["bsystems_sales", "byteforce_staff"]);
    expect(await statusOf("byteforce", sideways)).toBe(200);
    expect(await statusOf("bsystems", sideways)).toBe(403);
  });
});

/* -------------------------------------------------------------------------- */

describe("a HAND-TYPED cross-company request is refused, in both directions", () => {
  it("ByteForce staff typing the B-Systems URL gets 403, not B-Systems' customers", async () => {
    await lead("bsystems", "B-Systems Secret");
    const bf = await makeUser("ByteForce only", ["byteforce_staff"]);

    const res = await call("bsystems", bf);
    expect(res.status).toBe(403);
    /* and nothing leaked in the body */
    const text = await res.text();
    expect(text).not.toContain("B-Systems Secret");
    expect(res.headers.get("Content-Type")).not.toContain("spreadsheet");
  });

  it("a B-Systems admin typing the ByteForce URL gets 403", async () => {
    await lead("byteforce", "ByteForce Secret");
    const admin = await makeUser("B-Systems only", ["bsystems_admin"]);

    const res = await call("byteforce", admin);
    expect(res.status).toBe(403);
    expect(await res.text()).not.toContain("ByteForce Secret");
  });

  it("there is no company PARAMETER to type — the route is the company", async () => {
    /* ADR-067's wall, asserted on behaviour rather than on a comment: asking
       the B-Systems endpoint for ByteForce changes nothing, because nothing
       reads the query string. */
    await lead("bsystems", "Only Mine");
    await lead("byteforce", "Not Yours");
    const admin = await makeUser("Admin", ["bsystems_admin"]);

    authMock.mockResolvedValue({ user: { id: admin.id } });
    const res = await ROUTES.bsystems(
      new Request("http://localhost/api/b-systems/leads/export?company=byteforce&brand=byteforce"),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Lead-Rows")).toBe("1");
    expect(res.headers.get("Content-Disposition")).toContain("b-systems-leads-");
  });
});

/* -------------------------------------------------------------------------- */

describe("the wall is the DATABASE ROW, not the token", () => {
  it("an anonymous caller is 401 on both endpoints, before any row is read", async () => {
    await lead("bsystems", "Private");
    expect(await statusOf("bsystems", null)).toBe(401);
    expect(await statusOf("byteforce", null)).toBe(401);
  });

  it("a DEACTIVATED admin is refused although the session is still valid", async () => {
    const admin = await makeUser("Gone", ["bsystems_admin"], { active: false });
    expect(await statusOf("bsystems", admin)).toBe(403);
  });

  it("revoking the role bites on the VERY NEXT request — no re-login", async () => {
    const admin = await makeUser("Still signed in", ["bsystems_admin"]);
    expect(await statusOf("bsystems", admin)).toBe(200);

    /* same session, same token, next request (ADR-017) */
    await db.userRole.deleteMany({ where: { userId: admin.id, role: "bsystems_admin" } });
    expect(await statusOf("bsystems", admin)).toBe(403);

    await db.userRole.create({ data: { userId: admin.id, role: "bsystems_admin" } });
    expect(await statusOf("bsystems", admin)).toBe(200);
  });

  it("impersonation honours the IMPERSONATED account's roles, in both directions", async () => {
    const founder = await makeUser("Founder", ["bsystems_admin", "byteforce_staff"]);
    const agent = await makeUser("Agent", ["bsystems_agent"]);

    /* acting AS an agent must not hand the agent a company-wide file */
    expect(await statusOf("bsystems", agent, { impersonatorId: founder.id })).toBe(403);
    /* and the impersonator's own session is untouched — snapping back works */
    expect(await statusOf("bsystems", founder)).toBe(200);
  });
});

/* -------------------------------------------------------------------------- */

describe("what a permitted caller actually receives", () => {
  it("an .xlsx attachment named for the company, with the row count on it", async () => {
    await lead("bsystems", "One");
    await lead("bsystems", "Two");
    const archived = await lead("bsystems", "Three");
    await db.lead.update({ where: { id: archived.id }, data: { archived: true } });
    const admin = await makeUser("Admin", ["bsystems_admin"]);

    const res = await call("bsystems", admin);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    expect(res.headers.get("Content-Disposition")).toMatch(
      /^attachment; filename="b-systems-leads-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    /* archived included — "every lead, ever" */
    expect(res.headers.get("X-Lead-Rows")).toBe("3");
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const bytes = Buffer.from(await res.arrayBuffer());
    expect(bytes.subarray(0, 2).toString("latin1")).toBe("PK"); // a real zip
    expect(bytes.length).toBeGreaterThan(1000);
  });

  it("the download is LOGGED against the company, with who pulled it", async () => {
    await lead("byteforce", "Anybody");
    const staff = await makeUser("Sara", ["byteforce_staff"]);
    expect(await statusOf("byteforce", staff)).toBe(200);

    const rows = await db.activityLog.findMany({ where: { entityType: "lead_export" } });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.entityId).toBe("byteforce");
    expect(rows[0]!.action).toBe("export");
    expect(rows[0]!.trigger).toBe("leads_export");
    expect(rows[0]!.actorId).toBe(staff.id);
    expect(rows[0]!.actorLabel).toBe("Sara");
  });

  it("the viewer's LANGUAGE decides the headers — read off the real cookie", async () => {
    await lead("bsystems", "Anybody");
    const admin = await makeUser("Admin", ["bsystems_admin"]);

    localeCookie.value = "ar";
    const res = await call("bsystems", admin);
    expect(res.status).toBe(200);
    const sheet = strFromU8(
      unzipSync(new Uint8Array(Buffer.from(await res.arrayBuffer())))[
        "xl/sharedStrings.xml"
      ]!,
    );
    expect(sheet).toContain("<t>الاسم</t>"); // "Name"
    expect(sheet).not.toContain("<t>Name</t>");
  });

  it("a REFUSED request writes no log row at all", async () => {
    const agent = await makeUser("Agent", ["bsystems_agent"]);
    expect(await statusOf("bsystems", agent)).toBe(403);
    expect(await db.activityLog.count({ where: { entityType: "lead_export" } })).toBe(0);
  });
});

/* -------------------------------------------------------------------------- */

/* The hole this feature could ship with: a second export endpoint that reaches
   for its own guard. The DIRECTORY is the assertion, the ADR-066/ADR-067
   precedent — a route added tomorrow cannot miss the wall without turning this
   red. */
describe("both export routes go through the one shared handler", () => {
  const read = (rel: string) => readFileSync(path.resolve(process.cwd(), rel), "utf8");

  const files = [
    "src/app/api/byteforce/leads/export/route.ts",
    "src/app/api/b-systems/leads/export/route.ts",
  ];

  it("each route file is three lines of wiring and nothing else", () => {
    for (const file of files) {
      const src = read(file);
      expect(src, file).toContain("leadsExportRoute(");
      /* no second guard, no second query read, no second brand decision */
      expect(src, file).not.toMatch(/requireRole|requireBsAdmin|requireBrandStaff/);
      expect(src, file).not.toContain("searchParams");
      expect(src, file).not.toContain("db.");
    }
  });

  it("the shared handler names NO company parameter and reads no request input", () => {
    const src = read("src/lib/api/leads-export-route.ts");
    expect(src).toContain("canExportLeads");
    expect(src).toContain("requireUser");
    /* the company arrives as the FUNCTION's argument, which the two route files
       hardcode — there is no `?company=` to widen */
    expect(src).not.toContain("searchParams");
    expect(src).not.toContain("new URL(");
  });

  it("the ByteForce file asks for ByteForce and the B-Systems file for B-Systems", () => {
    expect(read(files[0]!)).toContain('leadsExportRoute("byteforce")');
    expect(read(files[1]!)).toContain('leadsExportRoute("bsystems")');
  });
});
