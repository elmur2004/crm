import { redirect } from "next/navigation";
import { requireRole, requireUser, type CurrentUser } from "./guards";
import { landingFor } from "./landing";
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
