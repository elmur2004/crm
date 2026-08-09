import { auth } from "./index";
import { db } from "@/lib/db";
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
  return {
    id: user.id,
    name: user.name,
    roles: user.roles.map((r) => r.role as Role),
    portalRepId: user.portalRep?.id ?? null,
  };
}

export async function requireRole(...roles: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.roles.some((r) => roles.includes(r))) {
    throw new ApiError(403, "You do not have access to this area");
  }
  return user;
}

/** Brand-partitioned API namespaces derive the brand from the ROUTE, never input.
    V2 (ADR-030): B-Systems "staff-level" = admin + internal sales. */
export function staffRolesForBrand(brand: Brand): Role[] {
  return brand === "byteforce" ? ["byteforce_staff"] : ["bsystems_admin", "bsystems_sales"];
}

export async function requireBrandStaff(brand: Brand): Promise<CurrentUser> {
  return requireRole(...staffRolesForBrand(brand));
}

export async function requireBsAdmin(): Promise<CurrentUser> {
  return requireRole("bsystems_admin");
}

/** V2 lead access: admin → any B-Systems lead; sales → internal-bucket leads;
    agent/partner → ONLY their own (ownerUserId). ByteForce: staff only. */
export async function requireLeadAccess(leadId: string): Promise<{
  user: CurrentUser;
  isAdmin: boolean;
  role: Role;
}> {
  const user = await requireUser();
  const lead = await db.lead.findUnique({
    where: { id: leadId },
    select: { brand: true, ownerType: true, ownerUserId: true },
  });
  if (!lead) throw new ApiError(404, "Lead not found");

  if (lead.brand === "byteforce") {
    if (!user.roles.includes("byteforce_staff")) throw new ApiError(403, "No access");
    return { user, isAdmin: false, role: "byteforce_staff" };
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
        // ZodError — invalid input
        return Response.json(
          { error: "Invalid input", issues: (err as { issues: unknown }).issues },
          { status: 400 },
        );
      }
      console.error(err);
      return Response.json({ error: "Internal error" }, { status: 500 });
    }
  };
}
