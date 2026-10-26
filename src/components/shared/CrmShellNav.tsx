"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ShellNav } from "@/components/shared/ShellNav";
import { NotificationsBell } from "@/components/bsystems/NotificationsBell";
import { companyInParams, crmQuery, type CrmCompany } from "@/lib/crm/company";
import { crmAppContextFor, PARTNERS_COMPANY, type CrmAppContext } from "@/lib/crm/nav";

/* ============================================================================
   The merged shell's chrome — which APP of the shell is on screen.

   One way to each page (founder): the shell hosts five launcher apps — the two
   CRMs, Partners & Agents, the To-Do and the Reports & Dashboards pages (the
   two dashboards and the daily report) — and the header shows the menu of the
   one you are in, or none:

     a CRM page               that company's CRM menu
     a Partners & Agents page the Partners & Agents menu (B-Systems admin only)
     the To-Do                no menu — one page
     a dashboard, the report  no menu — a page of Reports & Dashboards

   and NAMES that app beside the mark, so the person always knows where he is:
   with the company switch gone, the name is what says "ByteForce CRM" or
   "B-Systems CRM" in words.

   Client-side for one reason only: the app is decided by the PATHNAME and the
   company by `?company=`, and a server layout can read neither. That is why
   AcctModuleNav is a client component too — this is that pattern. Both compose
   ShellNav rather than re-implementing it.

   Everything is computed on the SERVER and handed down: each menu per company,
   the Partners & Agents menu only to the admin, each name already translated.
   The browser only PICKS between what it was given, so it cannot invent a menu
   item the server did not authorise — a company an account does not hold has
   no entry, and the code falls back to the company it does hold.
   ========================================================================== */

export type PerCompany<T> = Partial<Record<CrmCompany, T>>;
type Item = { href: string; label: string };

/** The company the URL asks for, narrowed to one the server actually sent. */
function pick<T>(map: PerCompany<T>, params: URLSearchParams, fallback: CrmCompany): T | undefined {
  const asked = companyInParams(params);
  return (asked && map[asked]) ?? map[fallback];
}

/** The company this render is for: the URL's, when the server sent it. */
function useCompany(known: PerCompany<unknown>, fallback: CrmCompany): CrmCompany {
  const asked = companyInParams(useSearchParams());
  return (asked && known[asked] !== undefined ? asked : fallback) as CrmCompany;
}

export function CrmShellNav({
  navs,
  partners,
  fallback,
  extras,
}: {
  /** each company's CRM menu (only the companies this account holds) */
  navs: PerCompany<Item[]>;
  /** the Partners & Agents menu — empty for anybody but the B-Systems admin */
  partners: Item[];
  /** the company in force when the URL does not say (the server's default) */
  fallback: CrmCompany;
  extras?: React.ReactNode;
}) {
  const context = crmAppContextFor(usePathname());
  const company = useCompany(navs, fallback);
  const items =
    context === "crm"
      ? (navs[company] ?? []).map((item) => ({ ...item, href: `${item.href}${crmQuery(company)}` }))
      : context === "partners"
        ? partners.map((item) => ({ ...item, href: `${item.href}${crmQuery(PARTNERS_COMPANY)}` }))
        : /* the To-Do and the Reports pages have no menu of their own; the
             phone sheet still opens, carrying the language, theme and log out */
          [];
  return <ShellNav items={items} extras={extras} />;
}

/** The header's app name, beside the plain brand mark (no longer a link: the
    grid icon is the one way back to the launcher). */
export function CrmAppName({
  names,
  fallback,
}: {
  /** per app, translated; `crm` per company held */
  names: { crm: PerCompany<string> } & Record<Exclude<CrmAppContext, "crm">, string>;
  fallback: CrmCompany;
}) {
  const context = crmAppContextFor(usePathname());
  const company = useCompany(names.crm, fallback);
  const name = context === "crm" ? (names.crm[company] ?? "") : names[context];
  return (
    <span className="wordmark app-name" data-app-context={context}>
      {name}
    </span>
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
