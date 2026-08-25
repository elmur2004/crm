import { redirect } from "next/navigation";
import { requireRole, requireUser, type CurrentUser } from "./guards";
import { landingFor } from "./landing";
import { canUseModule, type ModuleKey } from "./roles";
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
