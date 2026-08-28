"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { parseCompany, type CrmCompany } from "@/lib/crm/company";

/* ============================================================================
   ADR-067 — the merged shell's company-aware chrome.

   Client-side for one reason only: these three things must know which company
   is on screen, and a server LAYOUT cannot read searchParams. That is exactly
   why AcctModuleNav is a client component too — this is that pattern, not a
   fork of it. Both compose ShellNav rather than re-implementing it, and
   ShellNav already matches its active item on the PATH of a query-carrying
   href, so it needed no change for any of this.

   Everything company-shaped is computed on the SERVER and handed down per
   company. The browser only PICKS between lists it was given, so it cannot
   invent a nav item, a home, or an API base the server did not authorise — a
   company an account does not hold simply has no entry, and the code falls
   back to the company it does hold.
   ========================================================================== */

export type PerCompany<T> = Partial<Record<CrmCompany, T>>;

/** The company the URL asks for, narrowed to one the server actually sent. */
function pick<T>(map: PerCompany<T>, params: URLSearchParams, fallback: CrmCompany): T | undefined {
  const asked = parseCompany(params.get("company"));
  return (asked && map[asked]) ?? map[fallback];
}

export function CrmShellNav({
  navs,
  fallback,
  extras,
}: {
  navs: PerCompany<Array<{ href: string; label: string }>>;
  /** the company in force when the URL does not say (the server's default) */
  fallback: CrmCompany;
  extras?: React.ReactNode;
}) {
  const params = useSearchParams();
  const asked = parseCompany(params.get("company"));
  const company = (asked && navs[asked] ? asked : fallback) as CrmCompany;
  const items = (navs[company] ?? []).map((item) => ({
    href: `${item.href}?company=${company}`,
    label: item.label,
  }));
  return <ShellNav items={items} extras={extras} />;
}

/** The header mark. It goes to THIS company's own first destination — never
    the platform root, and never the other company's home (which is how the
    logo used to throw a switched founder back to B-Systems). */
export function CrmHomeLink({
  homes,
  fallback,
  label,
  children,
}: {
  homes: PerCompany<string>;
  fallback: CrmCompany;
  label: string;
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const asked = parseCompany(params.get("company"));
  const company = (asked && homes[asked] ? asked : fallback) as CrmCompany;
  return (
    <Link
      href={`${homes[company] ?? "/b-systems"}?company=${company}`}
      className="shrink-0 flex items-center gap-3"
      aria-label={label}
    >
      {children}
    </Link>
  );
}

/** The bell, pointed at the CURRENT company's namespace.

    This matters for access, not just for tidiness. A ByteForce view polling
    /api/b-systems/notifications would 403 for a ByteForce-only teammate — and
    for the founder it would show him B-Systems admin BROADCASTS while he is
    looking at ByteForce. Notifications carry no brand column; the two feeds are
    separated by the ROUTE, and "am I an admin" is decided inside the B-Systems
    route from the role alone. The ByteForce route passes isAdmin:false, as it
    always has. Nobody sees a notification they could not see before. */
export function CrmShellBell({
  bases,
  fallback,
}: {
  /** apiBase + leadPathBase per company; a company with no bell has no entry */
  bases: PerCompany<{ apiBase: string; leadPathBase: string; leadQuery: string }>;
  fallback: CrmCompany;
}) {
  const params = useSearchParams();
  const base = pick(bases, params, fallback);
  if (!base) return null;
  return (
    <NotificationsBell
      apiBase={base.apiBase}
      leadPathBase={base.leadPathBase}
      leadQuery={base.leadQuery}
    />
  );
}
