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

/** The two companies, in DEFAULT-FIRST order — see `defaultCompanyFor`. */
export const CRM_COMPANIES = ["bsystems", "byteforce"] as const;
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

/** Every role that may enter the merged shell at all (either company). */
export const CRM_ROLES: readonly [Role, ...Role[]] = [...BS_CRM_ROLES, "byteforce_staff"];

/** Which companies these roles can see. NARROWING ONLY — never a grant. */
export function companiesFor(roles: Role[]): CrmCompany[] {
  const held: CrmCompany[] = [];
  /* CRM_COMPANIES order is load-bearing: bsystems first, so an account
     holding BOTH defaults to B-Systems — the founder's own words, "I just
     want the b systems CRM", and the same precedence LANDING_PRIORITY
     already gives bsystems_admin over byteforce_staff. */
  if (roles.some((r) => BS_CRM_ROLES.includes(r))) held.push("bsystems");
  if (roles.includes("byteforce_staff")) held.push("byteforce");
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

/** A `?company=` value off the wire, or null when it is absent or junk. */
export function parseCompany(raw: string | undefined | null): CrmCompany | null {
  return (CRM_COMPANIES as readonly string[]).includes(raw ?? "") ? (raw as CrmCompany) : null;
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
export function resolveCompany(roles: Role[], requested?: string | null): CompanyResolution {
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

/** Append the company to an href that may already carry a query string. */
export function withCompany(href: string, company: CrmCompany): string {
  return `${href}${href.includes("?") ? "&" : "?"}company=${company}`;
}
