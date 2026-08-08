import { auth } from "./index";
import { db } from "@/lib/db";
import type { Brand, Role } from "@/lib/pipeline-engine/constants";

/* SPEC §3's hard rules live HERE, not in the UI. Every route handler calls a guard;
   guards re-read `active` + roles from the database on every request (ADR-017) — the
   JWT contributes identity only. Failures throw ApiError, which handleRoute maps to
   401/403 JSON. */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

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

/** Brand-partitioned API namespaces derive the brand from the ROUTE, never input. */
export function staffRoleForBrand(brand: Brand): Role {
  return brand === "byteforce" ? "byteforce_staff" : "bsystems_staff";
}

export async function requireBrandStaff(brand: Brand): Promise<CurrentUser> {
  return requireRole(staffRoleForBrand(brand));
}

export async function requirePortalAdmin(): Promise<CurrentUser> {
  return requireRole("portal_admin");
}

/** Owner-or-admin semantics (§3: admin gets "everything a rep can, plus"). */
export async function requireDealAccess(dealId: string): Promise<{
  user: CurrentUser;
  isAdmin: boolean;
}> {
  const user = await requireRole("portal_rep", "portal_admin");
  const isAdmin = user.roles.includes("portal_admin");
  if (isAdmin) return { user, isAdmin };
  const deal = await db.portalDeal.findUnique({ where: { id: dealId }, select: { repId: true } });
  if (!deal) throw new ApiError(404, "Deal not found");
  if (!user.portalRepId || deal.repId !== user.portalRepId) {
    throw new ApiError(403, "You can only access your own deals"); // rep isolation (§3)
  }
  return { user, isAdmin };
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
