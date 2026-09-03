import { auth } from "./index";
import { db } from "@/lib/db";
import { MODULE_ADMIN_ROLES, canUseModule, type ModuleKey } from "./roles";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";

/* SPEC §3's hard rules live HERE, not in the UI. Every route handler calls a guard;
   guards re-read `active` + roles from the database on every request (ADR-017) — the
   JWT contributes identity only. Failures throw ApiError, which handleRoute maps to
   401/403 JSON. */

export { ApiError } from "@/lib/api-error";
import { ApiError } from "@/lib/api-error";

export type CurrentUser = {
  id: string;
  name: string;
  roles: Role[];
  portalRepId: string | null;
  /** set while an admin is acting as this user (snap-back impersonation) */
  impersonatorId: string | null;
  /* ADR-066 — per-admin module access, read fresh from the User row on EVERY
     request like `active` and the roles are. Deliberately NOT in the JWT: a
     revoked admin must lose the module on his very next request, not at his
     next sign-in. Under impersonation the row read here is the IMPERSONATED
     user's (the session's `user.id` is theirs; `impersonatorId` only remembers
     who to snap back to), so acting as someone honours THEIR access. */
  canAccessAccounting: boolean;
  canAccessVault: boolean;
};

/** Identity from the session + fresh authorization state from the DB (ADR-017). */
export async function requireUser(): Promise<CurrentUser> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new ApiError(401, "Not signed in");
  const user = await db.user.findUnique({
    where: { id },
    include: { roles: true, portalRep: { select: { id: true } } },
  });
  if (!user || !user.active) throw new ApiError(403, "Account is deactivated");
  if (user.registrationStatus !== "approved") {
    throw new ApiError(403, "Your registration is awaiting approval");
  }
  return {
    id: user.id,
    name: user.name,
    roles: user.roles.map((r) => r.role as Role),
    portalRepId: user.portalRep?.id ?? null,
    impersonatorId: session?.user?.impersonatorId ?? null,
    canAccessAccounting: user.canAccessAccounting,
    canAccessVault: user.canAccessVault,
  };
}

/** The role check on an ALREADY-authenticated caller. Split out so a route
    that must authenticate BEFORE it touches the database on untrusted input
    (see requireLeadAccess's `known`) can still run the house role check
    without a second session round-trip. */
export function assertRole(user: CurrentUser, ...roles: Role[]): CurrentUser {
  if (!user.roles.some((r) => roles.includes(r))) {
    throw new ApiError(403, "You do not have access to this area");
  }
  return user;
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  return assertRole(await requireUser(), ...roles);
}

/** Brand-partitioned API namespaces derive the brand from the ROUTE, never input.
    V2 (ADR-030): B-Systems "staff-level" = admin + internal sales. */
export function staffRolesForBrand(brand: Brand): Role[] {
  /* ADR-073 — a table for the same reason configForBrand became one: a third
     company must not inherit a second company's staff by falling off the end of
     a ternary. Mindoo's staff is its one role. */
  const byBrand: Record<Brand, Role[]> = {
    byteforce: ["byteforce_staff"],
    bsystems: ["bsystems_admin", "bsystems_sales"],
    mindoo: ["mindoo_staff"],
  };
  return byBrand[brand];
}

export async function requireBrandStaff(brand: Brand): Promise<CurrentUser> {
  return requireRole(...staffRolesForBrand(brand));
}

export async function requireBsAdmin(): Promise<CurrentUser> {
  return requireRole("bsystems_admin");
}

/* ---- ADR-066: the two MODULE walls ----------------------------------------

   Founder: "I want to have the ability to block some admins from acsessing
   accounting or data vault."

   `requireBsAdmin` is no longer enough for /api/accounting/** or /api/vault/**:
   admin is the FLOOR, and a per-user flag can take one module away on top of
   it. Every route under those two namespaces calls the matching guard here
   instead — a route that forgets is a hole, so `module-access.integration.test`
   reads both directories and fails if any route file still reaches for the old
   guard.

   The authorization state is re-read from the database inside `requireUser`, so
   revoking a flag bites on the NEXT request with no re-login (ADR-017's rule,
   extended). The edge proxy still gates these paths on the role alone — it runs
   on the edge runtime and cannot reach Postgres — which is why THIS is the wall
   and the proxy is only navigation hygiene. */

export async function requireModule(module: ModuleKey): Promise<CurrentUser> {
  /* ADR-074 — the FLOOR is now "an administrator of some company", which is
     `bsystems_admin` or Mindoo's single staff role (see MODULE_ADMIN_ROLES).
     It was the B-Systems literal, which would have bounced Mindoo's own
     administrator out of the module the founder asked for by name.

     This widens WHO reaches the module and not one row of WHAT they see: every
     handler behind it narrows the company through lib/accounting/tenancy.ts or
     lib/services/vault/tenancy.ts against these same live roles. */
  const user = assertRole(await requireUser(), ...MODULE_ADMIN_ROLES);
  if (!canUseModule(user, module)) {
    throw new ApiError(403, MODULE_DENIED[module]);
  }
  return user;
}

/** Kept as its own message per module so a 403 body names what was refused. */
const MODULE_DENIED: Record<ModuleKey, string> = {
  accounting: "Your account does not have access to Accounting",
  vault: "Your account does not have access to the Data Vault",
};

export async function requireAccounting(): Promise<CurrentUser> {
  return requireModule("accounting");
}

export async function requireVault(): Promise<CurrentUser> {
  return requireModule("vault");
}

/* ---- ADR-051: the data-entry role's TWO permissions, and nothing else ----

   Founder: "This user is just able to add leads or partners or agents... They
   are just adding, and they will not be the owner of what they add."
   These guards are deliberately narrow and named for the ACT, not the role, so
   the permission set stays readable: everything else in the B-Systems API
   keeps its own role list, which does not mention data entry — so every other
   endpoint refuses it by construction rather than by remembering to. */

/** May add a card to the Partners & Agents board (admin, or data entry). */
export async function requireProspectCreator(): Promise<CurrentUser> {
  return requireRole("bsystems_admin", "bsystems_data_entry");
}

/* the predicate itself is pure and lives in ./roles, so services and their
   tests can use it without pulling next-auth in; re-exported for route code */
export { isDataEntry } from "./roles";
export { canUseModule, MODULE_KEYS, type ModuleKey } from "./roles";

/** V2 lead access: admin → any B-Systems lead; sales → internal-bucket leads;
    agent/partner → ONLY their own (ownerUserId). ByteForce: staff only. */
export async function requireLeadAccess(
  leadId: string,
  /* Review hardening: an already-authenticated caller. A route that must
     resolve the record from untrusted input (the To-Do done routes look a
     FollowUp/Meeting id up to find its lead) authenticates FIRST and passes
     the user in — so an anonymous POST is refused before any database work
     and can never tell a real record id from a made-up one. */
  known?: CurrentUser,
): Promise<{
  user: CurrentUser;
  isAdmin: boolean;
  role: Role;
}> {
  const user = known ?? (await requireUser());
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { brand: true, ownerType: true, ownerUserId: true },
  });
  if (!lead) throw new ApiError(404, "Lead not found");

  if (lead.brand === "byteforce") {
    if (!user.roles.includes("byteforce_staff")) throw new ApiError(403, "No access");
    return { user, isAdmin: false, role: "byteforce_staff" };
  }
  /* ADR-073 — Mindoo. One staff role, which IS the company's whole staff, so it
     reaches every Mindoo lead; and `isAdmin` is TRUE because that person is the
     nearest thing Mindoo has to an administrator — editing and deleting their
     own company's leads is theirs to do, exactly as it is a B-Systems admin's.

     What `isAdmin` must NOT be read to mean here is "may assign this lead to
     somebody": the assignable roster is B-Systems' agents, partners and
     internal sales, and a Mindoo lead must never be handed to one of them. The
     lead detail withholds that control unless the company is B-Systems, and the
     assign ENDPOINT is unreachable anyway — it lives in /api/b-systems/**,
     which refuses a caller without a B-Systems role, and this branch refuses a
     B-Systems caller a Mindoo lead. */
  if (lead.brand === "mindoo") {
    if (!user.roles.includes("mindoo_staff")) throw new ApiError(403, "No access");
    return { user, isAdmin: true, role: "mindoo_staff" };
  }
  if (user.roles.includes("bsystems_admin")) {
    return { user, isAdmin: true, role: "bsystems_admin" };
  }
  if (user.roles.includes("bsystems_sales")) {
    if (lead.ownerType !== "internal") {
      throw new ApiError(403, "Sales can only work internal leads");
    }
    return { user, isAdmin: false, role: "bsystems_sales" };
  }
  if (user.roles.includes("bsystems_agent") || user.roles.includes("bsystems_partner")) {
    if (lead.ownerUserId !== user.id) {
      throw new ApiError(403, "You can only access your own leads");
    }
    return {
      user,
      isAdmin: false,
      role: user.roles.includes("bsystems_agent") ? "bsystems_agent" : "bsystems_partner",
    };
  }
  throw new ApiError(403, "No access");
}

/** Route-handler wrapper: Zod + ApiError → clean JSON responses. */
export function handleRoute<T extends unknown[]>(
  fn: (...args: T) => Promise<Response>,
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      if (err && typeof err === "object" && "issues" in err) {
        // ZodError — surface the FIRST issue's message so forms show the real rule
        const issues = (err as { issues: Array<{ message?: string }> }).issues;
        return Response.json(
          { error: issues?.[0]?.message ?? "Invalid input", issues },
          { status: 400 },
        );
      }
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
