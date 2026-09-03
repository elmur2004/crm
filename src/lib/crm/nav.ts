import type { CrmCompany } from "./company";
import type { Msg } from "@/lib/i18n/core";
import type { Role } from "@/lib/pipeline-engine/constants";
import { nav as bsNav } from "@/lib/i18n/dict/crm";
import { nav as bfNav } from "@/lib/i18n/dict/internal";
import { todoPage } from "@/lib/i18n/dict/todo";
import { calendarPage } from "@/lib/i18n/dict/calendar";

/* ============================================================================
   ADR-067 — the nav ADAPTS to the company you are switched to.

   Founder decision 6, as a table: B-Systems has sections ByteForce does not
   (Won Leads, Partners & Agents, Partners, Agents, Registrations, Statements,
   Users) and ByteForce has its own (Clients, and the rep directory behind
   Leads). Switched to a company, you are shown only what exists for it. A link
   that would 404, show an empty foreign screen, or quietly display the other
   company's data is never rendered — so this table is the only place nav items
   are decided, it is keyed by BOTH the company and the role, and nav.test.ts
   checks every entry against the guards' own section map: it reads each href's
   page file and fails the table if the guard there would refuse the company or
   the role the nav offered the link under. (e2e/company-switch.spec.ts walks
   the same property through a browser; the unit test is the one that answers
   in a second when you edit the lists below.)

   The labels are the ones each company's users read TODAY: the ByteForce items
   keep dict/internal's strings (its "CRM" is المبيعات in Arabic, which is what
   ByteForce staff have always seen) and the B-Systems items keep dict/crm's,
   untouched. Nothing here changes an existing English string.
   ========================================================================== */

export interface CrmNavItem {
  href: string;
  label: Msg;
}

/* Every ByteForce screen, in the order AppNav has always rendered them. This
   list retires with the ByteForce chrome but not the ByteForce nav. */
const BYTEFORCE_NAV: CrmNavItem[] = [
  { href: "/b-systems", label: bfNav.home },
  { href: "/b-systems/todo", label: todoPage.navItem },
  { href: "/b-systems/calendar", label: calendarPage.navItem },
  { href: "/b-systems/leads", label: bfNav.leads },
  { href: "/b-systems/crm", label: bfNav.crm },
  { href: "/b-systems/clients", label: bfNav.clients },
];

/* The B-Systems navs, verbatim from the shell layout they used to live in. */
const BSYSTEMS_NAV: Record<string, CrmNavItem[]> = {
  bsystems_admin: [
    { href: "/b-systems", label: bsNav.home },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/leads", label: bsNav.leads },
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/partners-pipeline", label: bsNav.partnersAndAgents },
    { href: "/b-systems/partners", label: bsNav.partners },
    { href: "/b-systems/agents", label: bsNav.agents },
    { href: "/b-systems/registrations", label: bsNav.registrations },
    { href: "/b-systems/statements", label: bsNav.statements },
    /* ADR-054: Accounting and Data Vault left this nav — they are MODULES on
       the switcher now (EntitySwitch), peers of the CRM. */
    { href: "/b-systems/users", label: bsNav.users },
  ],
  bsystems_sales: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
  ],
  bsystems_agent: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/payments", label: bsNav.payments },
    { href: "/b-systems/profile", label: bsNav.profile },
  ],
  bsystems_partner: [
    { href: "/b-systems/crm", label: bsNav.crm },
    { href: "/b-systems/todo", label: todoPage.navItem },
    { href: "/b-systems/calendar", label: calendarPage.navItem },
    { href: "/b-systems/won-leads", label: bsNav.wonLeads },
    { href: "/b-systems/payments", label: bsNav.payments },
    { href: "/b-systems/profile", label: bsNav.profile },
  ],
  /* ADR-051 — the data-entry role adds and nothing else, so it has exactly ONE
     destination. A one-item nav is the honest picture of the permission set. */
  bsystems_data_entry: [{ href: "/b-systems/entry", label: bsNav.dataEntry }],
};

/* ADR-074 — MINDOO's nav, and it is NOT part of the table above.

   Founder: "remove the switcher from bsystems system seperate them entirly
   nothing inside bsystems goes to mindoo and vice versa." ADR-073 had Mindoo as
   a third value of `crmNavFor`, which meant its items were B-Systems addresses
   with `?company=mindoo` on them — the two systems sharing a URL space is
   exactly what he asked us to undo. Every href here is Mindoo's OWN, and there
   is deliberately no query string on any of them: /mindoo answers the company
   question by being /mindoo.

   WHAT IT CARRIES is the lead half of the B-Systems shape: Home, the To-Do, the
   Calendar, Leads, the board, and Won Leads — the last because a Mindoo win
   opens the same milestone tab and writes the same Won Deal (the founder chose
   the B-Systems pipeline for Mindoo when asked).

   WHAT IT DELIBERATELY DOES NOT CARRY is the partner/agent subsystem — Partners
   & Agents, Partners, Agents, Registrations, Statements, Payments, Profile and
   the data-entry page. Founder, verbatim: "no partners or regestrations or
   agents or their crm at all". Every one of those exists FOR external agents
   and partners, and Mindoo has a single internal staff role.

   Users is absent for a different reason: accounts are platform-wide and are
   administered from B-Systems, not per company. Accounting and the Data Vault
   are absent from THIS list for a third reason — they are MODULES on the
   EntitySwitch, peers of the CRM (ADR-054), and Mindoo reaches them there
   exactly as B-Systems does. */
export const MINDOO_NAV: CrmNavItem[] = [
  { href: "/mindoo", label: bsNav.home },
  { href: "/mindoo/todo", label: todoPage.navItem },
  { href: "/mindoo/calendar", label: calendarPage.navItem },
  { href: "/mindoo/leads", label: bsNav.leads },
  { href: "/mindoo/crm", label: bsNav.crm },
  { href: "/mindoo/won-leads", label: bsNav.wonLeads },
];

/** Mindoo's whole nav. A function, not the bare constant, so its ONE call site
    reads like the merged shell's `crmNavFor` and a future second Mindoo role
    has a place to be answered. */
export function mindooNav(): CrmNavItem[] {
  return MINDOO_NAV;
}

/** The nav for one company OF THE MERGED SHELL. `bsRole` is the account's
    single B-Systems role (bsRoleOrNull), and is irrelevant under ByteForce,
    which has one staff role and therefore one nav. An account with no role for
    this company gets NO items, never a borrowed set.

    ADR-074 — Mindoo is not a case here and cannot be: `CrmCompany` no longer
    contains it, so the compiler refuses a Mindoo branch in this function. Its
    nav is `mindooNav` above, and its shell is the only thing that calls it. */
export function crmNavFor(company: CrmCompany, bsRole: Role | null): CrmNavItem[] {
  if (company === "byteforce") return BYTEFORCE_NAV;
  return (bsRole && BSYSTEMS_NAV[bsRole]) ?? [];
}

/** Where the mark in the header links to for this company and role — that
    company's own first destination, never the platform root. */
export function crmHomeFor(company: CrmCompany, bsRole: Role | null): string {
  return crmNavFor(company, bsRole)[0]?.href ?? "/b-systems";
}
