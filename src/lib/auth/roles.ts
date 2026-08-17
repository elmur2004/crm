import type { Role } from "@/lib/pipeline-engine/constants";

/* Pure role predicates — no next-auth, no DB, so services and unit tests can
   import them without dragging the whole auth runtime along. */

/** The shape every predicate here needs: an identity plus its roles. */
export type RoleBearer = { id: string; name: string; roles: Role[] };

/** ADR-051: an ADD-ONLY account. An admin who also happens to hold the role is
    not "a data-entry user" — they keep every admin right, so the narrow
    data-entry carve-outs must not apply to them. */
export function isDataEntry(user: { roles: Role[] }): boolean {
  return user.roles.includes("bsystems_data_entry") && !user.roles.includes("bsystems_admin");
}
