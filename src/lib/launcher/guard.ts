import { redirect } from "next/navigation";
import { requireUser, type CurrentUser } from "@/lib/auth/guards";

/* The launcher's page wall.

   /apps sits OUTSIDE src/proxy.ts's matcher (that list names /byteforce,
   /b-systems, /portal, /accounting and /vault only), so NOTHING at the edge
   stops an anonymous request from reaching these pages. This guard is the
   only wall, and it is the house one: `requireUser` re-reads `active`, the
   registration status, the roles and both module flags from the database on
   every request (ADR-017 / ADR-066). Anything short of a live, approved
   account — no session, a deactivated account, a pending signup — is sent to
   the sign-in page, exactly as /no-access does.

   It grants nothing: which tiles the account then sees is lib/launcher/apps.ts,
   which narrows the access the account already holds. */
export async function requireLauncherUser(): Promise<CurrentUser> {
  const me = await requireUser().catch(() => null);
  if (!me) redirect("/login");
  return me;
}
