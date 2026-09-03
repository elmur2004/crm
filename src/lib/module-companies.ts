import { BRANDS, type Brand, type Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-074 — WHICH COMPANIES A MODULE SHOWS THIS ACCOUNT.

   Founder: Mindoo has "vault and accounting and the crm and to do and calender
   all the other things"; and, in the same breath, "nothing inside bsystems goes
   to mindoo and vice versa."

   Those two sentences together are this file. Accounting and the Data Vault are
   MODULES (ADR-054) — one screen set with a COMPANY FILTER on it, not one
   application per company — so Mindoo does not need a second Accounting; it
   needs the same one, opened to a different set of companies. That is the
   cheapest honest answer, and it is also the safest: there is one query layer,
   one importer, one export format and one set of tests, with a single predicate
   deciding what any account may point them at.

   THE LAW OF THIS FILE, stated once and matching `companiesFor`'s in
   lib/crm/company.ts: it NARROWS. It reads the roles an account already holds
   and reports which companies' books and records those roles open. There is no
   branch here that can hand anybody a company a role does not already carry,
   and every caller must treat a company OUTSIDE the returned list as absent —
   not as forbidden. A module shows a tab for each company in this list and no
   others, so a B-Systems admin is never offered Mindoo's books and Mindoo's
   staff is never offered ByteForce's.

   ORDER IS LOAD-BEARING: the first entry is the DEFAULT the module opens on
   when the URL does not say, so ByteForce stays first for the accounts that
   have always landed there (ADR-052 directive D, the SPA's default tenant).
   ========================================================================== */

export function moduleCompaniesFor(roles: Role[]): Brand[] {
  const held: Brand[] = [];
  /* B-Systems' administrator keeps EXACTLY the two companies he has had since
     ADR-052. Adding Mindoo to the platform must not add a tab to his books. */
  if (roles.includes("bsystems_admin")) held.push("byteforce", "bsystems");
  /* Mindoo's staff is its own company's administrator, and its whole world is
     one company. */
  if (roles.includes("mindoo_staff")) held.push("mindoo");
  return held;
}

/** The company a module renders: the one the URL asks for when this account
    holds it, otherwise this account's default. NULL only when the account holds
    no company at all, which the module's role guard has already refused.

    It FALLS BACK rather than refusing, deliberately, and that is the accounting
    module's own long-standing convention (params.ts: "Bad values fall back
    rather than 400 on a PAGE"). Falling back is safe here precisely because the
    fallback is by construction a company this account holds — the same argument
    `resolveCompany` makes for the CRM. What must never happen is the third
    thing: rendering a company's rows under another company's label. */
export function resolveModuleCompany(
  allowed: readonly Brand[],
  requested: string | readonly string[] | undefined | null,
): Brand | null {
  const one = Array.isArray(requested)
    ? requested.length === 1
      ? requested[0]
      : null
    : (requested as string | null | undefined);
  const asked = (BRANDS as readonly string[]).includes(one ?? "") ? (one as Brand) : null;
  if (asked && allowed.includes(asked)) return asked;
  return allowed[0] ?? null;
}
