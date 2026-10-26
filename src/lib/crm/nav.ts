import type { CrmCompany } from "./company";
import type { Msg } from "@/lib/i18n/core";
import type { Role } from "@/lib/pipeline-engine/constants";
import { nav as bsNav } from "@/lib/i18n/dict/crm";
import { nav as bfNav } from "@/lib/i18n/dict/internal";
import { calendarPage } from "@/lib/i18n/dict/calendar";
import { launcher } from "@/lib/i18n/dict/launcher";

/* ============================================================================
   THE MENUS OF THE MERGED SHELL — one way to each page.

   Founder: "there is multiple ways to get to each page there should be one way
   each for each page to get to". His four answers, in code:

     1. "Two CRM icons, no switch" — ByteForce CRM and B-Systems CRM are two
        launcher apps. There is no company switch inside the shell any more:
        which CRM you are in is the tile you opened (`?company=` rides the URL,
        as it has since ADR-067).
     2. "Only in Reports & Dashboards" — the two dashboards (`/b-systems?company=…`)
        left these menus. Each CRM opens straight onto its board.
     3. (Accounting's own reports stay in Accounting's menu — lib/accounting/nav.ts.)
     4. "Remove them" — a content link that repeats a menu is gone; a link to a
        RECORD stays, because it is the only way to reach that record.

   So To-Do, the Daily report, the dashboards and the four Partners & Agents
   screens are NOT in a CRM menu: each is its own launcher app (To-Do, Reports &
   Dashboards, Partners & Agents). `lib/launcher/menus.ts` composes every app's
   menu with the launcher tiles, and its guard test fails the day a page gains a
   second menu-level way in.

   ADR-067 still holds for what is here: a menu is keyed by BOTH the company and
   the role, so a link that would 404, show an empty foreign screen, or quietly
   display the other company's data is never rendered — nav.test.ts checks every
   entry against the page guards' own source.

   The labels are the ones each company's users read TODAY: the ByteForce items
   keep dict/internal's strings (its "CRM" is المبيعات in Arabic) and the
   B-Systems items keep dict/crm's.
   ========================================================================== */

export interface CrmNavItem {
  href: string;
  label: Msg;
}

/* ---------------------------------------------------------------- the CRMs */

/** ByteForce CRM (byteforce_staff): the board first — the tile opens it. */
const BYTEFORCE_NAV: CrmNavItem[] = [
  { href: "/b-systems/crm", label: bfNav.crm },
  { href: "/b-systems/leads", label: bfNav.leads },
  { href: "/b-systems/calendar", label: calendarPage.navItem },
  { href: "/b-systems/clients", label: bfNav.clients },
];

/** B-Systems CRM, per role. The board is first for every role that has one. */
const BSYSTEMS_NAV: Record<string, CrmNavItem[]> = {
  bsystems_admin: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/leads", label: bsNav.leads },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/statements", label: bsNav.statements },
    { href: "/b-systems/users", label: bsNav.users },
  ],
  bsystems_sales: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
  ],
  bsystems_agent: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/payments", label: bsNav.payments },
    { href: "/b-systems/profile", label: bsNav.profile },
  ],
  bsystems_partner: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/payments", label: bsNav.payments },
    { href: "/b-systems/profile", label: bsNav.profile },
  ],
  /* ADR-051 — the data-entry role has exactly ONE page, reached from its one
     launcher tile. A one-item menu would be a second way to the same page, so
     it has no menu at all. */
  bsystems_data_entry: [],
};

/** The data-entry role's one page (ADR-051) — its tile's destination. */
export const DATA_ENTRY_PATH = "/b-systems/entry";

/** The menu of one company's CRM. `bsRole` is the account's single B-Systems
    role (bsRoleOrNull), and is irrelevant under ByteForce, which has one staff
    role and therefore one menu. An account with no role for this company gets
    NO items, never a borrowed set.

    ADR-074 — `CrmCompany` rather than `Brand`: a company that is not one of
    this shell's cannot be given a branch here, because the type refuses it. */
export function crmNavFor(company: CrmCompany, bsRole: Role | null): CrmNavItem[] {
  if (company === "byteforce") return BYTEFORCE_NAV;
  return (bsRole && BSYSTEMS_NAV[bsRole]) ?? [];
}

/** Where a bounce inside this company's CRM lands for this role: the first
    item of that role's menu — the board, for every role that has one — or the
    data-entry role's one page. Never the dashboard any more: Home left the
    menus (founder answer 2). */
export function crmHomeFor(company: CrmCompany, bsRole: Role | null): string {
  const first = crmNavFor(company, bsRole)[0]?.href;
  if (first) return first;
  if (company === "bsystems" && bsRole === "bsystems_data_entry") return DATA_ENTRY_PATH;
  return "/b-systems";
}

/* --------------------------------------------------- the Partners & Agents app */

/** Partners & Agents — its own launcher app (B-Systems admin only), living in
    the same shell. The four screens the B-Systems admin menu used to carry. */
const PARTNERS_NAV: CrmNavItem[] = [
  { href: "/b-systems/partners-pipeline", label: bsNav.partnersPipeline },
  { href: "/b-systems/partners", label: bsNav.partners },
  { href: "/b-systems/agents", label: bsNav.agents },
  { href: "/b-systems/registrations", label: bsNav.registrations },
];

/** The company the Partners & Agents screens belong to — they are B-Systems'
    alone (requireBsAdminCompanyPage / requireCompanySection("bsystems", …)). */
export const PARTNERS_COMPANY: CrmCompany = "bsystems";

/** The Partners & Agents menu: the B-Systems admin's, nobody else's. Every one
    of its pages is admin-only, so any other role is handed no items rather
    than links that would bounce. */
export function partnersNavFor(bsRole: Role | null): CrmNavItem[] {
  return bsRole === "bsystems_admin" ? PARTNERS_NAV : [];
}

/* ----------------------------------------------- which app the page is part of */

/** Which app of the shell a path belongs to — what the header names and which
    menu it shows.

      crm       a CRM page: that company's CRM menu
      partners  /b-systems/partners-pipeline*, /partners*, /agents, /registrations:
                the Partners & Agents menu
      todo      the To-Do: its own app with one page, so NO menu
      reports   the two dashboards and the Daily report: pages of Reports &
                Dashboards, so NO menu (the launcher's Reports list is theirs) */
export type CrmAppContext = "crm" | "partners" | "todo" | "reports";

export function crmAppContextFor(pathname: string): CrmAppContext {
  const p = pathname.replace(/\/+$/, "") || "/";
  if (p === "/b-systems" || p === "/b-systems/daily-report") return "reports";
  if (p === "/b-systems/todo") return "todo";
  if (/^\/b-systems\/(partners-pipeline|partners)(\/|$)/.test(p)) return "partners";
  if (p === "/b-systems/agents" || p === "/b-systems/registrations") return "partners";
  return "crm";
}

/** The app's name, as its launcher tile says it — so the word under the icon
    and the word in the header of the screen it opens cannot drift. */
export function crmAppNameFor(context: CrmAppContext, company: CrmCompany): Msg {
  switch (context) {
    case "partners":
      return launcher.partners;
    case "todo":
      return launcher.todo;
    case "reports":
      return launcher.reports;
    case "crm":
      return company === "byteforce" ? launcher.crmByteforce : launcher.crmBsystems;
  }
}
