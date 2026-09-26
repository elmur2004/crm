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

/* ---------------------------------------------------------------- ADR-066 --
   Founder: "I want to have the ability to block some admins from acsessing
   accounting or data vault."

   The two switcher MODULES — Accounting and Data Vault — become per-admin.
   Access is TWO BOOLEAN COLUMNS on User, not two roles (the reasoning lives in
   the ADR and in the migration): both default true, so every admin that already
   exists keeps exactly what he had.

   The predicate is pure and lives here for one reason above all: it states, in
   ONE place that nothing can route around, that a flag NARROWS `bsystems_admin`
   and can never widen anything. The role is checked FIRST — a sales rep, an
   agent, a partner or a data-entry user with `canAccessVault = true` (which is
   what every row in the table says, because true is the column default) still
   gets nothing at all. Grant is not a thing this flag can do. */

export const MODULE_KEYS = ["accounting", "vault"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

/** The shape the predicate needs: roles plus the two flags off the User row. */
export type ModuleAccessBearer = {
  roles: Role[];
  canAccessAccounting: boolean;
  canAccessVault: boolean;
};

/* The roles that are their COMPANY'S ADMINISTRATOR, and therefore the floor for
   both modules. ADR-074 widened this from the `bsystems_admin` literal to admit
   Mindoo's own administrator; ADR-080 removed that company, so the list is one
   role again — kept as a LIST rather than folded back into a literal, because
   `assertRole(...)` and `canUseModule` both read it as a set, and a set with one
   member is the shape those callers already speak.

   It says WHO may open a module, never WHAT they see: which company's books and
   vault rows is `moduleCompaniesFor` in lib/module-companies.ts, and there
   alone. */
export const MODULE_ADMIN_ROLES: readonly [Role, ...Role[]] = ["bsystems_admin"];

export function canUseModule(user: ModuleAccessBearer, module: ModuleKey): boolean {
  /* the role is the FLOOR — no flag ever lifts a non-administrator over it */
  if (!user.roles.some((r) => (MODULE_ADMIN_ROLES as readonly Role[]).includes(r))) return false;
  return module === "accounting" ? user.canAccessAccounting : user.canAccessVault;
}
