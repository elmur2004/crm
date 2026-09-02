import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { mergedByteforcePath } from "@/lib/crm/legacy-routes";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Coarse route-group gating ONLY (edge runtime — JWT roles, no DB). The real
   enforcement is in lib/auth/guards.ts, which every route handler calls with a
   fresh DB read (ADR-017). §3: internal apps invisible to portal roles and vice
   versa; /portal/admin is admin-only. */

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  /^\/b-systems\/login/, // legacy path — the page redirects to /login (ADR-028)
  /^\/portal$/,
  /^\/portal\/login/,
  /^\/portal\/signup/,
];

/* ADR-028: one consolidated sign-in for every app. */
function loginPathFor(): string {
  return "/login";
}

function allowed(pathname: string, roles: Role[]): boolean {
  /* ADR-054: the Accounting and Data Vault MODULES — switcher peers of the two
     CRMs, admin-only. The page guards stay the real wall.

     ADR-066 made these two modules PER-ADMIN, and this check deliberately did
     NOT follow. It runs on the edge runtime, where there is no database
     connection and no Prisma; the only thing it can read is the JWT — and
     putting the flags in the token is precisely what ADR-066 refuses, because
     a token is minted at sign-in and a revoked admin must lose the module on
     his NEXT REQUEST, not at his next login. So this stays a coarse role check
     that lets a blocked admin through, and `requireModulePage` (page) /
     `requireModule` (API) refuse him a millisecond later against the live User
     row — with /no-access as the honest landing. The edge is navigation
     hygiene here; the server is the wall. */
  if (pathname.startsWith("/accounting") || pathname.startsWith("/vault")) {
    return roles.includes("bsystems_admin");
  }
  if (pathname.startsWith("/b-systems")) {
    // V2 (ADR-030): the role-aware B-Systems CRM — per-section scoping happens
    // in the page guards; any B-Systems role may enter the app shell.
    //
    // ADR-067: `byteforce_staff` is admitted too, because this prefix is now
    // the MERGED shell — a ByteForce-only teammate lives here. That widening
    // is safe for exactly the reason written above for the module flags: it is
    // navigation hygiene, and `requireCompanyPage` / `requireCompanySection`
    // narrow per section and per company against the LIVE User row a
    // millisecond later. A page that forgets to call one would be the hole, so
    // page-company-guards.integration.test reads the route directory and fails
    // naming any page.tsx that does not.
    //
    // Deliberately NOT checked here: the `?company=` value itself. The edge
    // has only the JWT, which is minted at sign-in and can be stale — refusing
    // a company on a stale token would turn a role change into a lockout,
    // which is the same trap ADR-066 refused for the module flags. The page
    // guard reads the live roles and is the wall.
    return (
      roles.includes("bsystems_admin") ||
      roles.includes("bsystems_sales") ||
      roles.includes("bsystems_agent") ||
      roles.includes("bsystems_partner") ||
      roles.includes("bsystems_data_entry") ||
      roles.includes("byteforce_staff") ||
      roles.includes("mindoo_staff") // ADR-073 — the third company lives here too
    );
  }
  return true; // /portal keeps only its public landing/signup pages
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  /* ADR-067 — the retired shell, before anything else. It runs ahead of the
     sign-in check so an anonymous visitor following an old bookmark is sent to
     the MERGED address first and only then asked to sign in: he arrives where
     he was going, instead of being bounced to /login from an address that no
     longer exists. */
  const merged = mergedByteforcePath(pathname);
  if (merged) {
    const url = req.nextUrl.clone();
    url.pathname = merged;
    if (merged === "/login") url.search = "";
    else url.searchParams.set("company", "byteforce");
    return NextResponse.redirect(url);
  }

  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const roles = (req.auth?.user?.roles ?? []) as Role[];
  if (!req.auth?.user) {
    const url = req.nextUrl.clone();
    url.pathname = loginPathFor();
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!allowed(pathname, roles)) {
    const url = req.nextUrl.clone();
    url.pathname = loginPathFor();
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/byteforce/:path*",
    "/b-systems/:path*",
    "/portal/:path*",
    "/accounting/:path*",
    "/vault/:path*",
  ],
};
