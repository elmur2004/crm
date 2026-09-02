import { BRANDS, type Brand, type Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-067 — ONE merged CRM, and the COMPANY lives in the URL.

   Founder, verbatim: "I need to completely merge the systems and byte force
   CRMs, and I want the switching to be inside the CRM... I just want the b
   systems CRM. I can have a switch button between b systems and byte force,
   and the entire boards change accordingly."

   So the B-Systems shell is now THE shell, and which company you are looking
   at is a QUERY PARAMETER on it — `?company=bsystems|byteforce` — exactly the
   idiom the accounting module already set (src/lib/accounting/params.ts: a
   company filter that rides every nav href through `acctQuery`). One idiom in
   one app; a switched view is a URL you can bookmark and send to somebody.

   Pure: no next-auth, no Prisma, no React. The page guards, the shell, the
   client-side switch and the unit tests all import the SAME predicate, so
   "which companies may this account see" is answered in exactly one place.

   THE LAW OF THIS FILE, stated once: `companiesFor` NARROWS. It reads the
   roles an account already holds and reports which company each of them lets
   it see. There is no branch here that can hand anybody a company a role does
   not already carry, and `resolveCompany` can only ever return a member of
   `companiesFor(roles)` — a property asserted directly in company.test.ts.
   Nobody gains access they do not have today; this file only decides which of
   the access they DO have is on screen. (Same voice, same rule, as ADR-066's
   `canUseModule` in ../auth/roles.ts.)
   ========================================================================== */

/** The companies, in DEFAULT-FIRST order — see `defaultCompanyFor`. ADR-073
    added Mindoo LAST, which is not arbitrary: this order decides which company
    an account holding several lands on, and the founder's "I just want the b
    systems CRM" has to keep winning. Appending can never change where anybody
    already lands. */
export const CRM_COMPANIES = ["bsystems", "byteforce", "mindoo"] as const;
export type CrmCompany = (typeof CRM_COMPANIES)[number];

/* CrmCompany is deliberately the SAME pair of literals as the pipeline
   engine's Brand: the company on screen IS the brand the services scope by,
   so there is no mapping table to get wrong. This line fails to compile the
   day the two drift apart. */
const _brandsMatch: readonly CrmCompany[] = BRANDS satisfies readonly Brand[];
void _brandsMatch;

/** The four B-Systems roles that live in the PIPELINE app — Home, the board,
    Leads, the To-Do, Won Leads and the rest. ADR-051 carved `bsystems_data_entry`
    out of every one of them: it adds and nothing else, and has exactly ONE
    destination. Keeping that carve-out spelled out here means the merged guards
    inherit it instead of quietly re-granting it. */
export const BS_PIPELINE_ROLES: readonly [Role, ...Role[]] = [
  "bsystems_admin",
  "bsystems_sales",
  "bsystems_agent",
  "bsystems_partner",
];

/** Every role that puts a person inside the B-Systems half of the CRM. */
export const BS_CRM_ROLES: readonly [Role, ...Role[]] = [
  ...BS_PIPELINE_ROLES,
  "bsystems_data_entry",
];

/** ADR-073 — Mindoo's whole staff, as a list for symmetry with the two above.
    One role today; a list because every caller here already speaks in lists,
    and a lone literal would be the one place that has to change shape if Mindoo
    ever grows a second role. */
export const MINDOO_ROLES: readonly [Role, ...Role[]] = ["mindoo_staff"];

/** Every role that may enter the merged shell at all (any company). */
export const CRM_ROLES: readonly [Role, ...Role[]] = [
  ...BS_CRM_ROLES,
  "byteforce_staff",
  ...MINDOO_ROLES,
];

/** ADR-073 — the roles that may work inside ONE company's shared screens.

    The five shared pages (Home, To-Do, Calendar, Leads, the board) each narrow
    to a different set depending on the company they are rendering. With two
    companies that was an `if` and an implicit else; with three it becomes a
    table, and a table is the only shape `nav.test.ts` can check without
    parsing branches out of source — it imports THIS and asks it, so the nav
    contract is tested against the function the pages actually call.

    Note what it is NOT: a grant. The company has already been resolved against
    the account's live roles before any page calls this. */
export function crmRolesFor(company: CrmCompany): readonly [Role, ...Role[]] {
  if (company === "byteforce") return ["byteforce_staff"];
  if (company === "mindoo") return MINDOO_ROLES;
  return BS_PIPELINE_ROLES;
}

/** Which companies these roles can see. NARROWING ONLY — never a grant. */
export function companiesFor(roles: Role[]): CrmCompany[] {
  const held: CrmCompany[] = [];
  /* CRM_COMPANIES order is load-bearing: bsystems first, so an account
     holding BOTH defaults to B-Systems — the founder's own words, "I just
     want the b systems CRM", and the same precedence LANDING_PRIORITY
     already gives bsystems_admin over byteforce_staff. */
  if (roles.some((r) => BS_CRM_ROLES.includes(r))) held.push("bsystems");
  if (roles.includes("byteforce_staff")) held.push("byteforce");
  /* ADR-073 — same narrowing, same shape: a company is held only because a role
     already carries it. Adding a third widens nobody's access. */
  if (roles.some((r) => MINDOO_ROLES.includes(r))) held.push("mindoo");
  return held;
}

/** True when this account may switch — i.e. holds BOTH companies. A locked
    account is shown no switch at all (there is nothing to switch to). */
export function canSwitchCompany(roles: Role[]): boolean {
  return companiesFor(roles).length > 1;
}

/** The company an account lands on when the URL does not say. A pure function
    of the ROLES — never a cookie, never a session, never "the last company you
    looked at": two people with the same roles must see the same thing at the
    same address, or the app has a hidden per-user mode. */
export function defaultCompanyFor(roles: Role[]): CrmCompany | null {
  return companiesFor(roles)[0] ?? null;
}

/** A `?company=` value off the wire, or null when it is absent or junk.

    ACCESS AUDIT, Run 081 — it takes `string[]` too, because that is what Next
    hands a server page for a REPEATED parameter (`?company=x&company=y`) and
    what `URLSearchParams.getAll` hands the client chrome. A repetition is junk
    to BOTH halves — one company, or none. It used to be junk to the server
    only (an array is not one of the two literals, so the page fell back to the
    account's default) while `params.get("company")` gave the switch, the nav
    and the bell the FIRST value, and the founder could be shown one company's
    rows under the other's label. Never an access hole — the fallback is by
    construction a company the account holds — but exactly the confusion the
    switch exists to prevent, so both halves now answer the same question
    through this one function. */
export function parseCompany(
  raw: string | readonly string[] | undefined | null,
): CrmCompany | null {
  const one = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : null) : (raw as string | null);
  return (CRM_COMPANIES as readonly string[]).includes(one ?? "") ? (one as CrmCompany) : null;
}

/** The company a QUERY STRING asks for — the client-side twin of the server's
    `searchParams.company`, and deliberately the same predicate. `getAll`, not
    `get`, so a repeated parameter reads as junk here exactly as it does on the
    server rather than silently becoming its first value. */
export function companyInParams(params: {
  getAll(name: string): string[];
}): CrmCompany | null {
  return parseCompany(params.getAll("company"));
}

export type CompanyResolution =
  /** render this company */
  | { kind: "ok"; company: CrmCompany; companies: CrmCompany[] }
  /** the URL named a REAL company this account does not hold — refuse it and
      send them to the company they do hold (never render the other one's data
      under the label they asked for) */
  | { kind: "refused"; company: CrmCompany; companies: CrmCompany[] }
  /** this account holds no CRM company at all */
  | { kind: "none" };

/** THE decision, in one place. `requested` is the raw `?company=` value.

    · absent or junk  → the account's default (the accounting precedent: a page
      falls back, it does not 400 on a bad query string)
    · a company held  → that company
    · a company NOT held → REFUSED, and the caller redirects. This is the one
      place this differs from accounting, on purpose: there, any admin may look
      at either company's books, so a fallback is honest. Here the companies
      are a permission, so a valid-but-unheld value is an access request and is
      answered by the server, not quietly swapped behind the same label. */
export function resolveCompany(
  roles: Role[],
  requested?: string | readonly string[] | null,
): CompanyResolution {
  const companies = companiesFor(roles);
  const fallback = companies[0];
  if (!fallback) return { kind: "none" };
  const asked = parseCompany(requested);
  if (asked && !companies.includes(asked)) return { kind: "refused", company: fallback, companies };
  return { kind: "ok", company: asked ?? fallback, companies };
}

/** The query string that keeps the current company when navigating — the twin
    of `acctQuery`. Every nav href, every switch link and every filter form in
    the merged shell carries it, so the company survives navigation. */
export function crmQuery(company: CrmCompany): string {
  return `?company=${company}`;
}

/** Put the company on an href that may already carry a query string — and at
    most ONCE. It used to append unconditionally, so calling it on an href that
    already named a company produced `?company=a&company=b`: the repeated shape
    the server discards and the chrome misreads (see `parseCompany`). `set`
    REPLACES, so the trap cannot be re-entered by the next caller. */
export function withCompany(href: string, company: CrmCompany): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("company", company);
  return `${path}?${params.toString()}`;
}
