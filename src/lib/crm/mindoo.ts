import { redirect } from "next/navigation";
import { requirePageRole } from "@/lib/auth/page-guards";
import { landingFor } from "@/lib/auth/landing";
import type { CurrentUser } from "@/lib/auth/guards";
import { MINDOO_ROLES } from "./company";

/* ============================================================================
   ADR-074 — the MINDOO page wall.

   Founder: "I need to have the system for mindoo completly identical to
   byteforce but with no partners or regestrations or agents or their crm at
   all… also remove the switcher from bsystems system seperate them entirly
   nothing inside bsystems goes to mindoo and vice versa."

   So Mindoo has its own app at /mindoo, and this is the one thing every page in
   it calls. It is deliberately the SIMPLEST guard in the codebase, and that is
   the point of the whole restructure: /b-systems needs `requireCompanyPage`
   because two companies share it and the URL has to say which one you meant;
   /mindoo needs only "is this account Mindoo's", because the route has already
   answered the other question.

   THE WALL IS THE ROLE, and it is read from the LIVE User row on every request
   (requirePageRole → requireRole → requireUser, ADR-017), never from the
   session token. A B-Systems admin does not hold `mindoo_staff` and is refused
   here exactly as a Mindoo account is refused at /b-systems — the separation
   runs BOTH ways, which is what the founder asked for and what the pair of
   guards, not either one alone, delivers.

   No company is resolved, no query string is read, nothing narrows. A page in
   this app cannot forget to pass a company because there is no company to pass.
   ========================================================================== */

/** Every Mindoo page's first line. Returns the account, or redirects: an
    unauthenticated visitor to /login, a signed-in account that is not Mindoo's
    to its OWN landing — never to a sign-in form it does not need (ADR-051). */
export async function requireMindooPage(): Promise<CurrentUser> {
  const user = await requirePageRole("/login", ...MINDOO_ROLES);
  /* belt. `requirePageRole` has already refused every account that does not
     hold one of MINDOO_ROLES, so this cannot fire — and it must still fail
     CLOSED rather than render Mindoo's board to whoever got past it. */
  if (!MINDOO_ROLES.some((r) => user.roles.includes(r))) redirect(landingFor(user.roles));
  return user;
}
