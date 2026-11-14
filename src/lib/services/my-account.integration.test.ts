import { beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   MY ACCOUNT — every person edits his own details (ADR-103).

   Founder, 2026-11-14: "If it's for a normal user, he can click on it to
   change his information too, so he can change his name, he can change his
   password and all of that."

   Through the REAL route modules (/api/me, /api/me/password, /api/me/cv), the
   real guards, the real services and the real Postgres; only the session is
   mocked, by module path, the pattern module-access.integration.test.ts set.
   What is proved here is the edge of that sentence: his name, his sign-in
   identifiers, his password — and NOTHING that is the admin's (roles, module
   flags, active, approval), nobody else's row, and never the two things the
   pinned admin's healer owns.
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string; impersonatorId?: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({ auth: authMock }));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { normalizePhone } from "@/lib/auth/phone";
import type { Role } from "@/lib/pipeline-engine/constants";
import { PATCH as patchMe } from "@/app/api/me/route";
import { POST as postPassword } from "@/app/api/me/password/route";
import { POST as postCv } from "@/app/api/me/cv/route";
import { POST as adminCreateUser } from "@/app/api/b-systems/users/route";
import { PATCH as adminPatchUser } from "@/app/api/b-systems/users/[id]/route";
import { getMyAccount } from "./my-account";
import { RESERVED_ADMIN_EMAILS } from "./bootstrap";

const PASSWORD = "old-password-1";

let seq = 0;
async function makeUser(
  name: string,
  roles: Role[],
  opts: { email?: string | null; phone?: string | null; active?: boolean } = {},
) {
  seq += 1;
  return db.user.create({
    data: {
      name,
      email: opts.email === undefined ? `person${seq}@example.com` : opts.email,
      phone: opts.phone === undefined ? `+2010666${String(seq).padStart(4, "0")}` : opts.phone,
      passwordHash: await hashPassword(PASSWORD),
      passwordPlain: PASSWORD,
      active: opts.active ?? true,
      roles: { create: roles.map((role) => ({ role })) },
    },
    include: { roles: true },
  });
}

const as = (u: { id: string } | null) => authMock.mockResolvedValue(u ? { user: { id: u.id } } : null);
const send = (url: string, method: string, body: unknown) =>
  new Request(`http://test${url}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
const patch = (body: unknown) => patchMe(send("/api/me", "PATCH", body));
const password = (body: unknown) => postPassword(send("/api/me/password", "POST", body));
const errorOf = async (res: Response) => ((await res.json()) as { error?: string }).error ?? "";

beforeEach(async () => {
  await resetDb();
  authMock.mockReset();
});

describe("a person edits his own details", () => {
  it("a sales rep renames himself and changes how he signs in — and it is on the record", async () => {
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    as(omar);
    const res = await patch({ name: "  Omar F.  ", email: " Omar.New@Example.com ", phone: "010 1111 2222" });
    expect(res.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: omar.id } });
    expect(after.name).toBe("Omar F.");
    expect(after.email).toBe("omar.new@example.com");
    expect(after.phone).toBe(normalizePhone("01011112222"));
    const log = await db.activityLog.findMany({ where: { entityId: omar.id, trigger: "account_edit" } });
    expect(log).toHaveLength(1);
    expect(log[0]!.actorId).toBe(omar.id);
  });

  it("every type of account can do it — ByteForce staff and data entry too", async () => {
    for (const roles of [["byteforce_staff"], ["bsystems_data_entry"], ["bsystems_admin"]] as Role[][]) {
      const u = await makeUser(`Person ${roles[0]}`, roles);
      as(u);
      const res = await patch({ name: `Renamed ${roles[0]}` });
      expect(res.status, roles.join()).toBe(200);
      expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).name).toBe(`Renamed ${roles[0]}`);
    }
  });

  it("roles, module flags, status and somebody else's id in the body change NOTHING", async () => {
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    const other = await makeUser("Someone Else", ["bsystems_sales"]);
    as(omar);
    const res = await patch({
      name: "Still Omar",
      id: other.id,
      userId: other.id,
      roles: ["bsystems_admin"],
      canAccessAccounting: true,
      canAccessVault: true,
      active: false,
      registrationStatus: "pending",
    });
    expect(res.status).toBe(200);
    const me = await db.user.findUniqueOrThrow({ where: { id: omar.id }, include: { roles: true } });
    expect(me.name).toBe("Still Omar");
    expect(me.roles.map((r) => r.role)).toEqual(["bsystems_sales"]);
    expect(me.active).toBe(true);
    expect(me.registrationStatus).toBe("approved");
    expect((await db.user.findUniqueOrThrow({ where: { id: other.id } })).name).toBe("Someone Else");
  });

  it("an email or phone that is another account's is refused (409) and nothing changes", async () => {
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    const sara = await makeUser("Sara Hassan", ["byteforce_staff"]);
    as(omar);
    const byEmail = await patch({ name: "Omar X", email: sara.email });
    expect(byEmail.status).toBe(409);
    expect(await errorOf(byEmail)).toMatch(/email belongs to another account/);
    const byPhone = await patch({ phone: sara.phone });
    expect(byPhone.status).toBe(409);
    expect((await db.user.findUniqueOrThrow({ where: { id: omar.id } })).name).toBe("Omar Farouk");
  });

  it("keeps at least one way to sign in — one may go, never both", async () => {
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    as(omar);
    const both = await patch({ email: "", phone: "" });
    expect(both.status).toBe(400);
    expect(await errorOf(both)).toMatch(/Keep an email or a phone/);
    const one = await patch({ email: "" });
    expect(one.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: omar.id } });
    expect(after.email).toBeNull();
    expect(after.phone).toBe(omar.phone);
  });

  it("refuses an invalid email or phone with the field's own message", async () => {
    as(await makeUser("Omar Farouk", ["bsystems_sales"]));
    expect(await errorOf(await patch({ email: "not-an-email" }))).toBe("Enter a valid email");
    expect(await errorOf(await patch({ phone: "12ab" }))).toBe("Enter a valid phone number");
    expect(await errorOf(await patch({ name: "   " }))).toBe("Enter your name");
  });
});

describe("the agent, the partner and the pinned admin", () => {
  it("an agent edits his profile: first + last name ARE his name, and his phone stays", async () => {
    const karim = await makeUser("Karim Adel", ["bsystems_agent"]);
    await db.portalRep.create({
      data: { userId: karim.id, firstName: "Karim", lastName: "Adel", address: "Cairo", speciality: "Sales" },
    });
    as(karim);
    const res = await patch({ firstName: "Karim", lastName: "Adel Jr", address: "Giza", speciality: "ERP" });
    expect(res.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: karim.id } })).name).toBe("Karim Adel Jr");
    const rep = await db.portalRep.findUniqueOrThrow({ where: { userId: karim.id } });
    expect([rep.address, rep.speciality]).toEqual(["Giza", "ERP"]);
    /* the single name field is not his — his name is his profile's */
    expect((await patch({ name: "Somebody" })).status).toBe(400);
    /* ADR-016: an agent signs in with his phone */
    const noPhone = await patch({ phone: "" });
    expect(noPhone.status).toBe(400);
    expect(await errorOf(noPhone)).toMatch(/signs in with his phone/);
    expect(await getMyAccount(karim.id)).toMatchObject({ kind: "agent", name: "Karim Adel Jr" });
  });

  it("only an agent has profile fields — anybody else sending them is refused, not ignored", async () => {
    as(await makeUser("Omar Farouk", ["bsystems_sales"]));
    expect((await patch({ address: "Somewhere" })).status).toBe(400);
  });

  it("a partner account keeps its company's name (the admin's), and edits its own sign-in", async () => {
    const login = await makeUser("Nile Partners", ["bsystems_partner"], { phone: null });
    const prospect = await db.partnerProspect.create({
      data: { name: "Mona", companyName: "Nile Partners", number: "01000000001", stage: "qualified", converted: true },
    });
    await db.partner.create({
      data: {
        prospectId: prospect.id,
        userId: login.id,
        companyName: "Nile Partners",
        keyPersonName: "Mona",
        keyPersonRole: "CEO",
        address: "Cairo",
        number: "01000000001",
        businessActivity: "Trading",
        importance: "high",
      },
    });
    as(login);
    const rename = await patch({ name: "Some Other Name" });
    expect(rename.status).toBe(400);
    expect(await errorOf(rename)).toMatch(/company's name/);
    expect((await patch({ email: "office@nile.example" })).status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: login.id } });
    expect([after.name, after.email]).toEqual(["Nile Partners", "office@nile.example"]);
    expect(await getMyAccount(login.id)).toMatchObject({
      kind: "partner",
      partner: { companyName: "Nile Partners" },
    });
  });

  it("the pinned admin renames himself, but his email and password are the healer's", async () => {
    const elmur = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"], {
      email: "admin@byteforce.com",
    });
    as(elmur);
    const moveEmail = await patch({ email: "boss@example.com" });
    expect(moveEmail.status).toBe(400);
    expect(await errorOf(moveEmail)).toMatch(/main admin's email is fixed/);
    /* the SAME email sent back with a new name is fine — nothing of the pin moved */
    expect((await patch({ name: "Elmur F", email: "admin@byteforce.com" })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: elmur.id } })).name).toBe("Elmur F");
    const pw = await password({ currentPassword: PASSWORD, newPassword: "brand-new-pass" });
    expect(pw.status).toBe(400);
    expect(await errorOf(pw)).toMatch(/pinned/);
    expect(await getMyAccount(elmur.id)).toMatchObject({ pinned: true });
  });
});

describe("a person changes his own password", () => {
  it("needs the current one, refuses the same one, and then both copies follow", async () => {
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    as(omar);
    const wrong = await password({ currentPassword: "nope", newPassword: "brand-new-pass" });
    expect(wrong.status).toBe(400);
    expect(await errorOf(wrong)).toBe("Current password is wrong");
    expect((await password({ currentPassword: PASSWORD, newPassword: PASSWORD })).status).toBe(400);
    expect((await password({ currentPassword: PASSWORD, newPassword: "short" })).status).toBe(400);

    const ok = await password({ currentPassword: PASSWORD, newPassword: "brand-new-pass" });
    expect(ok.status).toBe(200);
    const after = await db.user.findUniqueOrThrow({ where: { id: omar.id } });
    expect(await verifyPassword("brand-new-pass", after.passwordHash)).toBe(true);
    expect(await verifyPassword(PASSWORD, after.passwordHash)).toBe(false);
    /* the founder's standing directive: the admin sees every password */
    expect(after.passwordPlain).toBe("brand-new-pass");
    expect(await db.activityLog.count({ where: { entityId: omar.id, trigger: "password_changed" } })).toBe(1);
  });

  it("every type of account can — not only agents and partners as before", async () => {
    for (const roles of [["byteforce_staff"], ["bsystems_data_entry"], ["bsystems_admin"]] as Role[][]) {
      as(await makeUser(`Pw ${roles[0]}`, roles));
      expect((await password({ currentPassword: PASSWORD, newPassword: "brand-new-pass" })).status).toBe(200);
    }
  });
});

describe("the walls", () => {
  it("signed out is 401; deactivated is 403 — for both routes", async () => {
    as(null);
    expect((await patch({ name: "x" })).status).toBe(401);
    expect((await password({ currentPassword: PASSWORD, newPassword: "brand-new-pass" })).status).toBe(401);
    const gone = await makeUser("Former", ["bsystems_sales"], { active: false });
    as(gone);
    expect((await patch({ name: "x" })).status).toBe(403);
    expect((await password({ currentPassword: PASSWORD, newPassword: "brand-new-pass" })).status).toBe(403);
    expect((await db.user.findUniqueOrThrow({ where: { id: gone.id } })).name).toBe("Former");
  });

  it("the CV route is an agent's alone", async () => {
    as(await makeUser("Omar Farouk", ["bsystems_sales"]));
    const form = new FormData();
    form.append("cv", new File(["%PDF-1.7"], "cv.pdf", { type: "application/pdf" }));
    const res = await postCv(new Request("http://test/api/me/cv", { method: "POST", body: form }));
    expect(res.status).toBe(403);
  });
});

/* ---------------------------------------------------------------------------
   From the pre-push review (spec-guardian, 2026-11-14).
   --------------------------------------------------------------------------- */

describe("the healer's addresses are nobody's — on every path that sets an email", () => {
  it("the reserved set is the admin's email AND the legacy address the healer renames", () => {
    expect(RESERVED_ADMIN_EMAILS).toEqual(["admin@byteforce.com", "admin@b-systems.example"]);
  });

  it("My account refuses them (a legacy address would be renamed INTO the admin)", async () => {
    as(await makeUser("Omar Farouk", ["bsystems_sales"]));
    for (const email of RESERVED_ADMIN_EMAILS) {
      const res = await patch({ email: email.toUpperCase() });
      expect(res.status, email).toBe(409);
      expect(await errorOf(res)).toMatch(/reserved for the main admin/);
    }
  });

  it("the admin's Add user and editor refuse them too, and the pinned admin's own email stays", async () => {
    const elmur = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"], {
      email: "admin@byteforce.com",
    });
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    as(elmur);
    const created = await adminCreateUser(
      send("/api/b-systems/users", "POST", {
        name: "Sneaky",
        email: "admin@b-systems.example",
        password: "sneaky-pass-1",
        roles: ["bsystems_sales"],
      }),
    );
    expect(created.status).toBe(409);
    const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
    const moved = await adminPatchUser(
      send(`/api/b-systems/users/${omar.id}`, "PATCH", { email: "admin@b-systems.example" }),
      ctx(omar.id),
    );
    expect(moved.status).toBe(409);
    /* the pinned admin's own email, from the editor */
    const pinned = await adminPatchUser(
      send(`/api/b-systems/users/${elmur.id}`, "PATCH", { email: "boss@example.com" }),
      ctx(elmur.id),
    );
    expect(pinned.status).toBe(400);
    expect(await errorOf(pinned)).toMatch(/main admin's email is fixed/);
    expect((await db.user.findUniqueOrThrow({ where: { id: elmur.id } })).email).toBe("admin@byteforce.com");
    expect((await db.user.findUniqueOrThrow({ where: { id: omar.id } })).email).toBe(omar.email);
  });
});

describe("who counts as an agent or a partner here: the role AND the record", () => {
  it("an agent the admin made in Users (no profile) edits a plain name, and keeps a phone he has", async () => {
    const made = await makeUser("Made Agent", ["bsystems_agent"]);
    as(made);
    expect(await getMyAccount(made.id)).toMatchObject({ kind: "person", agent: null });
    expect((await patch({ name: "Made Agent Renamed" })).status).toBe(200);
    expect((await patch({ phone: "" })).status).toBe(400);
    /* an email-only one is not forced to add a phone just to save his name */
    const emailOnly = await makeUser("Email Agent", ["bsystems_agent"], { phone: null });
    as(emailOnly);
    expect((await patch({ name: "Email Agent Renamed" })).status).toBe(200);
  });

  it("a FORMER agent who still has a profile is a person — no profile form, no CV", async () => {
    const former = await makeUser("Former Agent", ["bsystems_sales"]);
    await db.portalRep.create({
      data: { userId: former.id, firstName: "Former", lastName: "Agent", address: "Cairo", speciality: "Sales" },
    });
    as(former);
    expect(await getMyAccount(former.id)).toMatchObject({ kind: "person", agent: null });
    expect((await patch({ name: "Now Sales" })).status).toBe(200);
    expect((await patch({ firstName: "Former" })).status).toBe(400);
  });
});

describe("while the admin is acting as someone, the History says so", () => {
  it("logs '<person> (via <admin>)', the chat's impersonation rule", async () => {
    const elmur = await makeUser("Elmur", ["bsystems_admin"]);
    const omar = await makeUser("Omar Farouk", ["bsystems_sales"]);
    authMock.mockResolvedValue({ user: { id: omar.id, impersonatorId: elmur.id } });
    expect((await patch({ name: "Omar F." })).status).toBe(200);
    const log = await db.activityLog.findFirstOrThrow({ where: { entityId: omar.id, trigger: "account_edit" } });
    expect(log.actorLabel).toBe("Omar Farouk (via Elmur)");
    expect(log.actorId).toBe(omar.id);
  });
});
