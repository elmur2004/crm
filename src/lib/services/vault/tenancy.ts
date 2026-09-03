import { ApiError } from "@/lib/api-error";
import { db } from "@/lib/db";
import { moduleCompaniesFor } from "@/lib/module-companies";
import type { Role } from "@/lib/pipeline-engine/constants";
import { VAULT_COMPANIES, type VaultCompany } from "./constants";

/* ============================================================================
   ADR-074 — THE DATA VAULT'S COMPANY WALL.

   Same problem as lib/accounting/tenancy.ts and the same answer: `company` was
   a FILTER while every account that could open the vault held both companies,
   and it becomes a TENANT selector the moment a third company exists whose
   staff must never see the other two — or be seen by them.

   THE UNTAGGED ROW is the one thing the books do not have to answer and the
   vault does. `VaultTask.company` and `VaultEmployee.company` are NULLABLE, and
   null has always meant "both / not tagged" (schema comment: "byteforce |
   bsystems | null = both"). Those rows were created by accounts of the original
   pair, before Mindoo existed, and they mean "either of OUR two" — not "every
   company that will ever exist on this platform". So:

     an untagged row is visible to an account that holds the module's DEFAULT
     company (ByteForce, the SPA's default tenant per ADR-052 directive D)

   which keeps every existing B-Systems admin's vault byte-for-byte what it was,
   and gives Mindoo exactly the rows tagged Mindoo. The alternative — showing
   untagged rows to everybody — would have leaked the founder's own untagged
   B-Systems tasks into Mindoo on day one, which is the opposite of "nothing
   inside bsystems goes to mindoo".

   404, NOT 403, on a company the account does not hold: a company it may not
   see must not be confirmed to exist (ADR-073's ruling, applied again).
   ========================================================================== */

type Bearer = { roles: Role[] };

/** The module's default company — the SPA's default tenant, and the owner of
    every row that was never tagged. */
export const VAULT_DEFAULT_COMPANY: VaultCompany = "byteforce";

/** Every company this account may see in the vault. NARROWING ONLY. */
export function vaultCompaniesOf(user: Bearer): VaultCompany[] {
  return moduleCompaniesFor(user.roles) as VaultCompany[];
}

/** Whether untagged (company = null) rows belong to this account — see above. */
export function seesUntagged(visible: readonly VaultCompany[]): boolean {
  return visible.includes(VAULT_DEFAULT_COMPANY);
}

/* The clause every vault list ANDs onto its own filters.

   It rides `AND`, deliberately, and never `OR`: several of these lists already
   build an `OR` for the search box, and spreading a second `OR` into the same
   object would silently REPLACE it — dropping the tenancy wall or the search,
   depending on the key order. `AND` collides with nothing today, and a
   collision would be a compile error rather than a quiet hole.

   TWO functions, not one with a flag, because the two are different TYPES and
   Prisma knows it: `company` is a required String on forms, links, sheets and
   documents and a nullable one on tasks and employees, so only the second may
   ever emit `company: null`. A single helper returning a union would have to be
   cast at every call site, and a cast is the thing that stops the compiler
   noticing the day one of those columns changes. */

/** Rows of the companies this account may see. For the four entities whose
    company column is REQUIRED. */
export function vaultCompanyWhere(
  visible: readonly VaultCompany[],
  requested: VaultCompany | undefined,
): { AND: Array<{ company: { in: string[] } }> } {
  return { AND: [{ company: { in: companyList(visible, requested) } }] };
}

/** The same wall for the two entities whose company column is NULLABLE, where
    null has always meant "not tagged". An explicitly REQUESTED company narrows
    to it alone — asking for one company's rows must not also return untagged
    ones — and otherwise the untagged rows come along for the account that owns
    them (see the header). */
export function vaultCompanyWhereNullable(
  visible: readonly VaultCompany[],
  requested: VaultCompany | undefined,
): { AND: Array<{ OR: Array<{ company: { in: string[] } | null }> }> } {
  const list = companyList(visible, requested);
  const clauses: Array<{ company: { in: string[] } | null }> = [{ company: { in: list } }];
  if (!requested && seesUntagged(visible)) clauses.push({ company: null });
  return { AND: [{ OR: clauses }] };
}

function companyList(
  visible: readonly VaultCompany[],
  requested: VaultCompany | undefined,
): string[] {
  return requested && visible.includes(requested) ? [requested] : [...visible];
}

/** Is a single row's company one this account may see? The scalar twin of the
    two `where` builders above, for the places that have already fetched a row
    (an assignee card, a record reached by id) and only need a yes or no. Keeps
    the nullable rule in ONE place: null means "not tagged", and untagged
    belongs to whoever holds the module default. */
export function visibleCompany(
  visible: readonly VaultCompany[],
  company: string | null,
): boolean {
  return company == null ? seesUntagged(visible) : visible.includes(company as VaultCompany);
}

/** Parse a company off the wire and refuse one this account does not hold. */
export function vaultCompanyOf(user: Bearer, raw: unknown): VaultCompany {
  if (typeof raw !== "string" || !(VAULT_COMPANIES as readonly string[]).includes(raw)) {
    throw new ApiError(400, "Unknown company");
  }
  return assertVaultCompany(user, raw as VaultCompany);
}

/** The wall for a company that arrived INSIDE a validated payload. `null` is
    allowed only for an account that owns untagged rows — otherwise a Mindoo
    account could create a task belonging to nobody, which is a row it would
    then not be able to see. */
export function assertVaultCompany<T extends VaultCompany | null | undefined>(
  user: Bearer,
  company: T,
): T {
  const visible = vaultCompaniesOf(user);
  if (company == null) {
    if (!seesUntagged(visible)) throw new ApiError(400, "Choose a company");
    return company;
  }
  if (!visible.includes(company)) throw new ApiError(404, "Not found");
  return company;
}

/* ---- the wall on ONE record ---------------------------------------------

   Every /api/vault/<kind>/[id] route acts on a record it found BY ID ALONE.
   That was proof of ownership while every vault account saw every row; with
   Mindoo on the platform it is proof of nothing, and it is exactly the hole
   ADR-073 found on `checkMilestone` — a guessed id is an edit, an archive, a
   file replacement or a completion on another company's record.

   404 rather than 403, again: a record this account may not see must not be
   confirmed to exist. */


type VaultRowKind = "form" | "link" | "sheet" | "document" | "task" | "employee";

const ROW_COMPANY: Record<VaultRowKind, (id: string) => Promise<{ company: string | null } | null>> = {
  form: (id) => db.vaultForm.findUnique({ where: { id }, select: { company: true } }),
  link: (id) => db.vaultLink.findUnique({ where: { id }, select: { company: true } }),
  sheet: (id) => db.vaultSheet.findUnique({ where: { id }, select: { company: true } }),
  document: (id) => db.vaultDocument.findUnique({ where: { id }, select: { company: true } }),
  task: (id) => db.vaultTask.findUnique({ where: { id }, select: { company: true } }),
  employee: (id) => db.vaultEmployee.findUnique({ where: { id }, select: { company: true } }),
};

/** Refuse a vault record whose company this account cannot see. Call it BEFORE
    the mutation, in every route that takes an id. */
export async function assertVaultRowVisible(
  user: Bearer,
  kind: VaultRowKind,
  id: string,
): Promise<void> {
  const row = await ROW_COMPANY[kind](id);
  /* a MISSING row is left to the service, which has its own 404 with the
     entity's own wording; this function answers only "may they see it" */
  if (!row) return;
  const visible = vaultCompaniesOf(user);
  const ok =
    row.company == null
      ? seesUntagged(visible)
      : visible.includes(row.company as VaultCompany);
  if (!ok) throw new ApiError(404, "Not found");
}
