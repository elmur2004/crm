/* ---- ADR-067: every retired /byteforce address still lands somewhere ------

   The ByteForce app shell is gone — one merged CRM, and the company is a
   query parameter on the B-Systems address. So `/byteforce/...` is now a
   REDIRECT MAP, and it is load-bearing forever, not just until bookmarks
   catch up: web pushes ALREADY DELIVERED to the founder's phone carry
   `/byteforce/leads/lead/<id>` and `/byteforce` baked into their payload
   (services/push/payload.ts at send time; the service worker opens the URL
   verbatim), and nothing can go back and rewrite them.

   Specific rules first, catch-all LAST — nothing under the prefix may 404,
   including the shapes with no merged twin (`/byteforce/leads/rep` with no
   rep, a stale `/byteforce/anything`), which land on ByteForce's home rather
   than on a Next 404.

   The redirect is TEMPORARY (307, the NextResponse default) on purpose. A 308
   is cached by a browser indefinitely; until the founder has confirmed the
   retirement of the ByteForce-branded shell (docs/PROGRESS.md), a permanent
   redirect would be a one-way door with no cheap way back. Promote it later.

   The incoming query string is PRESERVED and `company` merged into it — never
   replaced — so `/byteforce/crm?q=Cairo+Textiles` arrives filtered and
   `/byteforce/leads/rep/x?view=archived` arrives on the archive tab. */
const BYTEFORCE_ROUTES: Array<[RegExp, string]> = [
  [/^\/byteforce\/?$/, "/b-systems"],
  [/^\/byteforce\/(todo|crm|clients|leads)\/?$/, "/b-systems/$1"],
  [/^\/byteforce\/leads\/rep\/([^/]+)\/?$/, "/b-systems/leads/rep/$1"],
  [/^\/byteforce\/leads\/lead\/([^/]+)\/?$/, "/b-systems/leads/lead/$1"],
  [/^\/byteforce\/leads\/lead\/([^/]+)\/call\/?$/, "/b-systems/leads/lead/$1/call"],
];

/* ---- ADR-103: the two screens that LEFT the merged shell for the Users app --

   Founder (2026-11-14): "The users currently for the entire systems are sitting
   inside the bsystems CRM. Separate it … put it in a different app". Users and
   the agents' and partners' Profile became ONE app at /users, outside every
   CRM: the admin manages every account there, and everybody edits his own
   ("My account") — so Profile is no longer a page of the B-Systems CRM either
   (one way to each page).

   The old addresses still land, for the reason the ByteForce map above is
   forever: bookmarks, and a password-change link an agent may have saved. They
   are answered HERE, at the edge and before the sign-in check, rather than by
   a page left behind in the shell: a page there would be a screen with no menu
   item and nothing to render, which is exactly what the one-way-in and
   page-guard sweeps exist to refuse. The query string is DROPPED — `?company=`
   means nothing outside the CRM — except that Profile opens My account, its
   one meaning. Temporary (307) for the ByteForce map's reason. */
const MOVED_TO_USERS_APP: Array<[RegExp, string]> = [
  [/^\/b-systems\/users\/?$/, "/users"],
  [/^\/b-systems\/profile\/?$/, "/users?tab=me"],
];

/** Where a screen that moved out of the merged shell lives now, or null. */
export function movedOutOfShellPath(pathname: string): string | null {
  for (const [re, to] of MOVED_TO_USERS_APP) {
    if (re.test(pathname)) return to;
  }
  return null;
}

/** The merged address for a retired one, or null when this is not one. */
export function mergedByteforcePath(pathname: string): string | null {
  if (!/^\/byteforce(\/|$)/.test(pathname)) return null;
  /* the one address that is NOT a company view: sign-in stays consolidated */
  if (/^\/byteforce\/login(\/|$)/.test(pathname)) return "/login";
  for (const [re, to] of BYTEFORCE_ROUTES) {
    if (re.test(pathname)) return pathname.replace(re, to);
  }
  return "/b-systems"; // catch-all — never a 404
}
