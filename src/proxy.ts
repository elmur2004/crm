import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import type { Role } from "@/lib/pipeline-engine/constants";

/* Coarse route-group gating ONLY (edge runtime — JWT roles, no DB). The real
   enforcement is in lib/auth/guards.ts, which every route handler calls with a
   fresh DB read (ADR-017). §3: internal apps invisible to portal roles and vice
   versa; /portal/admin is admin-only. */

const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = [
  /^\/byteforce\/login/,
  /^\/b-systems\/login/,
  /^\/portal$/,
  /^\/portal\/login/,
  /^\/portal\/signup/,
];

function loginPathFor(pathname: string): string {
  if (pathname.startsWith("/byteforce")) return "/byteforce/login";
  if (pathname.startsWith("/b-systems")) return "/b-systems/login";
  return "/portal/login";
}

function allowed(pathname: string, roles: Role[]): boolean {
  if (pathname.startsWith("/byteforce")) return roles.includes("byteforce_staff");
  if (pathname.startsWith("/b-systems")) return roles.includes("bsystems_staff");
  if (pathname.startsWith("/portal/admin")) return roles.includes("portal_admin");
  if (pathname.startsWith("/portal")) {
    return roles.includes("portal_rep") || roles.includes("portal_admin");
  }
  return true;
}

export default auth((req) => {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  const roles = (req.auth?.user?.roles ?? []) as Role[];
  if (!req.auth?.user) {
    const url = req.nextUrl.clone();
    url.pathname = loginPathFor(pathname);
    url.search = "";
    return NextResponse.redirect(url);
  }
  if (!allowed(pathname, roles)) {
    const url = req.nextUrl.clone();
    url.pathname = loginPathFor(pathname);
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/byteforce/:path*", "/b-systems/:path*", "/portal/:path*"],
};
