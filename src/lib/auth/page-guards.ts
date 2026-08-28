import { redirect } from "next/navigation";
import { requireRole, requireUser, type CurrentUser } from "./guards";
import { landingFor } from "./landing";
import { canUseModule, type ModuleKey } from "./roles";
import {
  CRM_ROLES,
  crmQuery,
  resolveCompany,
  type CrmCompany,
} from "@/lib/crm/company";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Page-level guard: like requireRole but redirects instead of throwing
   (middleware already gates coarsely; this is the in-page fallback).

   ADR-051: a SIGNED-IN user who lacks this section's role is sent to their own
   landing, not to a sign-in form they do not need. The data-entry role made
   that visible — it has exactly one page, so every other B-Systems URL used to
   dump it on /login as if its session had expired. Only a genuinely
   unauthenticated request still goes to loginPath. */

export async function requirePageRole(loginPath: string, ...roles: Role[]): Promise<CurrentUser> {
  try {
    return await requireRole(...roles);
  } catch {
    const me = await requireUser().catch(() => null);
    if (me) redirect(landingFor(me.roles));
    redirect(loginPath);
  }
}

/* V2 — admin-only B-Systems pages: other B-Systems roles bounce to their board. */
export async function requireBsAdminPage(): Promise<CurrentUser> {
  const user = await requirePageRole(
    "/login",
    "bsystems_admin",
    "bsystems_sales",
    "bsystems_agent",
    "bsystems_partner",
  );
  if (!user.roles.includes("bsystems_admin")) redirect("/b-systems/crm");
  return user;
}

/* ---- ADR-066: the two MODULE page walls -----------------------------------

   The page twin of `requireModule` in ./guards. An admin whose flag was taken
   away is bounced to /no-access, which NAMES the module and offers the way
   back — an honest refusal instead of a bounce to a sign-in form he does not
   need, a blank screen, or (worse) a redirect that lands him somewhere the
   guard will bounce him from again.

   No loop is possible: /no-access lives in the brand-neutral (home) group, is
   outside the proxy matcher and outside both module route groups, and asks only
   for a signed-in account. A user who is not an admin at ALL never reaches this
   line — `requireBsAdminPage` above has already sent him to his own board, which
   is the behaviour that shipped with ADR-054 and must not change. */

export async function requireModulePage(module: ModuleKey): Promise<CurrentUser> {
  const user = await requireBsAdminPage();
  if (!canUseModule(user, module)) redirect(`/no-access?module=${module}`);
  return user;
}

export async function requireAccountingPage(): Promise<CurrentUser> {
  return requireModulePage("accounting");
}

export async function requireVaultPage(): Promise<CurrentUser> {
  return requireModulePage("vault");
}

/* ---- ADR-067: the COMPANY wall -------------------------------------------

   Founder: "I can have a switch button between b systems and byte force, and
   the entire boards change accordingly... make sure that this is there, and
   there is no confusion in it."

   One shell, two companies, and which one you are looking at rides the URL as
   `?company=`. A Next server LAYOUT can read neither searchParams nor the
   pathname, so the layout cannot be the wall: it can only ask "does this
   account hold ANY company". The per-company refusal therefore lives in every
   page's own guard — every page already receives `searchParams` — and a page
   that forgets one would be a hole, so `page-company-guards.integration.test`
   reads the whole route directory and fails naming any page.tsx that does not
   call one of the three guards below. The directory is the assertion, exactly
   as ADR-066 made it for the two module namespaces.

   NOBODY GAINS ACCESS. `resolveCompany` narrows only (see lib/crm/company.ts,
   and the 64-subset property test beside it), and the API namespaces were not
   touched at all: /api/byteforce/** still refuses a B-Systems-only caller and
   /api/b-systems/** still refuses a ByteForce-only one, from the ROUTE, never
   from a parameter. A `company` query on an API route would be the one way to
   widen this, so there isn't one. */

export interface CompanyPage {
  user: CurrentUser;
  /** the company this render is FOR — already checked against the live roles */
  company: CrmCompany;
  /** every company this account holds; two of them means the switch renders */
  companies: CrmCompany[];
}

/** The shared-screen guard: admits any CRM role, then decides the company.

    LOOP SAFETY, argued rather than hoped for. There is exactly one redirect
    here and it fires only when the URL named a REAL company this account does
    not hold. Its target is that account's OWN company home, which by
    construction carries a company the account does hold — so the same branch
    cannot fire on the target. `/b-systems` itself either renders (admin) or
    bounces once more by ROLE, to a page whose own guard resolves the same
    company again and is satisfied. Absent and junk values do NOT redirect at
    all (the accounting precedent: a page falls back rather than 400s on a bad
    query string), so the ordinary path costs zero extra round trips. */
export async function requireCompanyPage(requested?: string): Promise<CompanyPage> {
  const user = await requirePageRole("/login", ...CRM_ROLES);
  const resolved = resolveCompany(user.roles, requested);
  /* belt: requirePageRole already refused an account holding none of the six
     CRM roles, so this is unreachable — and it must still fail CLOSED */
  if (resolved.kind === "none") redirect(landingFor(user.roles));
  if (resolved.kind === "refused") redirect(`/b-systems${crmQuery(resolved.company)}`);
  return { user, company: resolved.company, companies: resolved.companies };
}

/** The guard for a screen that exists for ONE company only.

    Decision 6, in code: B-Systems has sections ByteForce does not (Won Leads,
    Partners, Agents, Registrations, Statements, Users, Payments, Profile, data
    Entry) and ByteForce has its own (Clients, the rep directory, its lead
    detail). Switched to the other company, those addresses do not exist — so
    they send you to that company's home rather than rendering an empty foreign
    screen or, worse, the other company's data under this company's label.

    It runs BEFORE the section's own role narrowing on purpose: a ByteForce-only
    teammate who types /b-systems/users must be redirected here, not fall
    through to `bsRoleOf` and turn into a 500. */
export async function requireCompanySection(
  only: CrmCompany,
  requested?: string,
): Promise<CompanyPage> {
  const page = await requireCompanyPage(requested);
  if (page.company !== only) redirect(`/b-systems${crmQuery(page.company)}`);
  return page;
}

/** The company-aware `requireBsAdminPage`: B-Systems only, admin only.
    Company first, THEN the role — so the ByteForce-only case never reaches the
    admin bounce (which would send him to a B-Systems board he cannot see). */
export async function requireBsAdminCompanyPage(requested?: string): Promise<CompanyPage> {
  const page = await requireCompanySection("bsystems", requested);
  if (!page.user.roles.includes("bsystems_admin")) redirect(`/b-systems/crm${crmQuery("bsystems")}`);
  return page;
}
