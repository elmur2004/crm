import type { Brand, Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ASSIGNED LEADS ONLY — the one predicate family for "whose leads may I see".

   Founder, verbatim (2026-11-08): "Currently, all the unassigned leads are seen
   by everyone. I want them just to be seen by the admin. And whenever I assign a
   lead for a new user … they can see the lead then. They don't see the entire
   leads which is unassigned or whatever, just assigning for them." And, asked
   about ByteForce: "Both companies now".

   So, for BOTH companies, on EVERY surface:

     · the COMPANY ADMIN sees every lead of that company, unassigned included;
     · everybody else who works leads sees ONLY the leads they OWN
       (`Lead.ownerUserId === user.id`).

   Unassigned means NO OWNER ACCOUNT — `ownerUserId` null — whatever the bucket
   and whatever legacy `salesRepId` card the row still carries. A SalesRep card
   is not an account and decides nobody's visibility any more.

   WHO IS A COMPANY ADMIN — answered HERE and nowhere else, so no screen can
   re-derive it inline and drift:

     B-Systems  `bsystems_admin` (unchanged since V2).
     ByteForce  an account holding `byteforce_staff` AND `bsystems_admin` — the
                platform administrator (today: the founder). ByteForce has one
                staff role and no admin role of its own; a dedicated
                `byteforce_admin` role could replace this rule later without
                touching a single caller, which is why it is a function.

   Pure: no next-auth, no Prisma. The guards, the services, the pages and the
   unit tests all import the same answer.
   ========================================================================== */

/** The shape these predicates need: the live roles (and, for a scope, the id). */
export type RoleHolder = { roles: readonly Role[] };

/** THE RULE, as data: the roles an account must hold ALL of to administer a
    company's leads. A table, for the reason every per-company rule in this
    codebase is one (ADR-073): a company must not inherit another company's
    admin by falling off the end of a ternary. Every reader below — the
    in-memory predicate AND the database filter — is built from this one row,
    so the two can never disagree (lead-scope.test.ts sweeps them together). */
export const COMPANY_ADMIN_ROLES: Record<Brand, readonly [Role, ...Role[]]> = {
  bsystems: ["bsystems_admin"],
  byteforce: ["byteforce_staff", "bsystems_admin"],
};

/** Is this account the administrator of THIS company's leads? */
export function isCompanyAdmin(user: RoleHolder, company: Brand): boolean {
  const needed = COMPANY_ADMIN_ROLES[company];
  if (!needed) return false;
  return needed.every((role) => user.roles.includes(role));
}

/** The same rule as a filter over USER rows (a Prisma `UserWhereInput` shape,
    spelled structurally so this module stays free of Prisma): every account
    that `isCompanyAdmin` would answer true for. For the one place that has to
    ask "who are this company's admins?" of the database — the lead chat's
    mentionable set. */
export function companyAdminUserWhere(company: Brand): {
  AND: Array<{ roles: { some: { role: string } } }>;
} {
  const needed = COMPANY_ADMIN_ROLES[company] ?? [];
  /* an unknown company has no admin: an AND that no row can satisfy */
  if (needed.length === 0) return { AND: [{ roles: { some: { role: "__no_company_admin__" } } }] };
  return { AND: needed.map((role) => ({ roles: { some: { role } } })) };
}

/** How far a viewer's lead scope reaches inside ONE company. Two shapes, and
    only two: the admin's whole company, or the viewer's own leads. (The old
    third shape — B-Systems sales seeing the whole internal bucket — is gone:
    it collapsed into "own".) */
export type LeadScope =
  | { kind: "all" } // the company admin
  | { kind: "own"; userId: string }; // everybody else who works leads

/** The scope this account reads THIS company's leads under. It only ever
    narrows: an admin is told "all", everyone else "own". Whether the account may
    open the screen at all is the page/route guard's question, asked first. */
export function leadScopeFor(user: { id: string } & RoleHolder, company: Brand): LeadScope {
  return isCompanyAdmin(user, company) ? { kind: "all" } : { kind: "own", userId: user.id };
}

/** The Prisma fragment a scope adds to a lead predicate (brand is the caller's). */
export function scopeOwnerWhere(scope: LeadScope): { ownerUserId?: string } {
  return scope.kind === "own" ? { ownerUserId: scope.userId } : {};
}

/** Does this scope reach this lead? The in-memory twin of `scopeOwnerWhere`, for
    the one surface that decides per row (the calendar's full/busy split). */
export function scopeReaches(scope: LeadScope, lead: { ownerUserId: string | null }): boolean {
  return scope.kind === "all" || lead.ownerUserId === scope.userId;
}
