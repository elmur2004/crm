import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { MINDOO_ROLES } from "@/lib/crm/company";
import type { Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-075 — WHOSE PEOPLE ARE THESE.

   Founder: "mindoo user should appear in mindoo system not in bsystems systems
   separate their users."

   ADR-073 decided the opposite — "accounts are platform-wide… a Mindoo teammate
   is created by the B-Systems admin" — and flagged it for his confirmation.
   This is the confirmation, and it goes the other way: each company administers
   its own people, and neither sees the other's.

   THE RULE, one line: an account holding `mindoo_staff` is MINDOO'S, and every
   other account is B-Systems'. Not "an account with only Mindoo roles" — that
   would make a dual-role account belong to both, and both administrators could
   then deactivate a person the other depends on. One owner per account, decided
   by the role that names a company, with no overlap possible.

   Nothing here grants anything. It NARROWS an administrator to the accounts
   that are already his, exactly as `companiesFor` narrows a reader to companies
   his roles already carry. The B-Systems admin loses no ability he had over his
   own people; he loses sight of somebody else's.

   404, NOT 403, on an account outside the scope — the ruling this codebase has
   applied at every company boundary since ADR-073. An account an administrator
   may not touch must not be confirmed to exist, because "403" on an email
   address is an answer to "does this person have an account here".
   ========================================================================== */

export type UserScope = "bsystems" | "mindoo";

/** The Prisma filter for the accounts this administrator administers. */
export function userScopeWhere(scope: UserScope) {
  const owning = { some: { role: { in: [...MINDOO_ROLES] as string[] } } };
  return scope === "mindoo" ? { roles: owning } : { roles: { none: owning.some } };
}

/** Which administrator owns an account, from its roles alone. */
export function scopeOfRoles(roles: readonly Role[]): UserScope {
  return roles.some((r) => (MINDOO_ROLES as readonly Role[]).includes(r)) ? "mindoo" : "bsystems";
}

/** The roles an administrator of this scope may GRANT.

    A B-Systems admin cannot mint a Mindoo account and a Mindoo admin cannot
    mint a B-Systems one — otherwise "separate their users" would hold for
    reading and not for writing, which is the half-wall this codebase keeps
    finding. Enforced in the SERVICE, so the API and any future caller inherit
    it; the checkbox list in the form is a courtesy, never the rule. */
export function grantableRoles(scope: UserScope): Role[] {
  if (scope === "mindoo") return [...MINDOO_ROLES];
  return [
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
    "bsystems_data_entry",
    "byteforce_staff",
  ];
}

/** Refuse a role set an administrator of this scope may not grant. */
export function assertGrantable(scope: UserScope, roles: readonly Role[]): void {
  const allowed = grantableRoles(scope);
  const refused = roles.filter((r) => !allowed.includes(r));
  if (refused.length > 0) {
    throw new ApiError(400, `You cannot assign: ${refused.join(", ")}`);
  }
}

/** Refuse an account this administrator does not administer. Call it BEFORE
    every edit, deactivation, deletion and impersonation. */
export async function assertUserInScope(scope: UserScope, userId: string): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { roles: { select: { role: true } } },
  });
  /* a MISSING account is left to the service, which has its own 404 and its own
     wording; this answers only "is it theirs" */
  if (!user) return;
  if (scopeOfRoles(user.roles.map((r) => r.role as Role)) !== scope) {
    throw new ApiError(404, "User not found");
  }
}
