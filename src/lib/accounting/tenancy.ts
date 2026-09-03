import { ApiError } from "@/lib/api-error";
import { moduleCompaniesFor } from "@/lib/module-companies";
import type { Role } from "@/lib/pipeline-engine/constants";
import { ACCT_COMPANIES, type AcctCompany } from "./constants";

/* ============================================================================
   ADR-074 — THE ACCOUNTING API'S COMPANY WALL.

   Accounting is the one namespace in this codebase where the company DOES ride
   the request. That was safe while every account that could reach these routes
   held both companies — a `company` parameter could not name anything the
   caller was not already entitled to, so it was a filter and nothing more.
   ADR-054 says so in as many words: "company is a FILTER, not a tenant".

   Adding Mindoo makes that sentence false. `company` is now genuinely a TENANT
   selector, and a route that merely parses it against ACCT_COMPANIES would let
   a B-Systems admin post `company=mindoo` and write into another company's
   books — the exact widening the CRM namespaces refuse by deriving the brand
   from the ROUTE instead of from input (see lib/api/internal-crm.ts).

   The CRM's answer is not available here: there is one Accounting, by design,
   so the route cannot carry the company. The answer is this file. Every place a
   company arrives from the wire goes through one of these two functions, which
   check it against `moduleCompaniesFor` on the LIVE roles — the same predicate
   the pages and the switcher use, so what the module OFFERS and what it ACCEPTS
   cannot drift apart.

   404, NOT 403. A company this account does not hold must not be confirmed to
   exist, and 403 on a valid company name is exactly that confirmation. This is
   the ruling ADR-073 made for cross-company milestones; the same one applies to
   the books. A company that is not a company at all is still a 400 — a
   malformed request and an unauthorised one are different facts.
   ========================================================================== */

type Bearer = { roles: Role[] };

/** Parse a company off the wire and refuse one this account does not hold. */
export function acctCompanyOf(user: Bearer, raw: unknown): AcctCompany {
  if (typeof raw !== "string" || !(ACCT_COMPANIES as readonly string[]).includes(raw)) {
    throw new ApiError(400, "Unknown company");
  }
  return assertAcctCompany(user, raw as AcctCompany);
}

/** The same wall for a company that arrived INSIDE a validated payload — Zod
    has already proved it is one of the platform's companies, and this proves it
    is one of THIS ACCOUNT's. Returns it so a call site can read as an
    assignment where that is clearer. */
export function assertAcctCompany(user: Bearer, company: AcctCompany): AcctCompany {
  if (!moduleCompaniesFor(user.roles).includes(company)) {
    throw new ApiError(404, "Not found");
  }
  return company;
}

/** Every company this account may export, import or read in bulk. */
export function acctCompaniesOf(user: Bearer): AcctCompany[] {
  return moduleCompaniesFor(user.roles) as AcctCompany[];
}
