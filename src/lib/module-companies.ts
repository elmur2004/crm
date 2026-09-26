import { BRANDS, type Brand, type Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   ADR-074 — WHICH COMPANIES A MODULE SHOWS THIS ACCOUNT.

   ADR-080 removed the second answer this function was written to give (Mindoo's)
   and the function stays, because the QUESTION it answers is not Mindoo's: a
   module is one screen set with a company FILTER on it (ADR-054), and every
   caller still has to be told which companies to filter to rather than assuming
   the platform's whole list. That is the distinction ADR-074 §5 drew between a
   filter and a tenant, and it survives the tenant leaving.

   THE LAW OF THIS FILE, stated once and matching `companiesFor`'s in
   lib/crm/company.ts: it NARROWS. It reads the roles an account already holds
   and reports which companies' books and records those roles open. There is no
   branch here that can hand anybody a company a role does not already carry,
   and every caller must treat a company OUTSIDE the returned list as absent —
   not as forbidden. A module shows a tab for each company in this list and no
   others.

   ORDER IS LOAD-BEARING: the first entry is the DEFAULT the module opens on
   when the URL does not say, so ByteForce stays first for the accounts that
   have always landed there (ADR-052 directive D, the SPA's default tenant).
   ========================================================================== */

export function moduleCompaniesFor(roles: Role[]): Brand[] {
  const held: Brand[] = [];
  /* B-Systems' administrator keeps EXACTLY the two companies he has had since
     ADR-052 — which, since ADR-080, is again every company there is. */
  if (roles.includes("bsystems_admin")) held.push("byteforce", "bsystems");
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
