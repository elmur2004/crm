import type { Msg } from "@/lib/i18n/core";
import type { Role } from "@/lib/pipeline-engine/constants";
import { canUseModule, type ModuleAccessBearer } from "@/lib/auth/roles";
import {
  BS_PIPELINE_ROLES,
  CRM_COMPANIES,
  companiesFor,
  crmQuery,
  crmRolesFor,
  type CrmCompany,
} from "@/lib/crm/company";
import { launcher as m, launcherReports as r } from "@/lib/i18n/dict/launcher";

/* ============================================================================
   THE APP LAUNCHER — which tiles a person sees, and where each one goes.

   Founder: "I need to change the interface a little bit. It should be
   something like this, with little icons opening each section: accounting;
   each CRM, byteforce and bsystems; vault; to-do; reports + dashboards;
   partners and agents group them in an icon also." He chose HOME AFTER
   SIGN-IN: signing in lands on this grid, a home icon in every header brings
   you back, and the existing header menus stay for moving inside an app.

   THE LAW OF THIS FILE: A TILE IS A PROMISE. A person is shown a tile only if
   the screen behind it renders for them WITHOUT A REDIRECT — not merely
   "without a 403", because a tile that bounces you somewhere else is the same
   broken promise in politer clothes. So every rule below is the SAME predicate
   the destination's own guard runs, imported rather than restated:

     companiesFor / crmRolesFor   the merged CRM's company + role walls (ADR-067/073)
     canUseModule                 the per-admin Accounting / Vault flags (ADR-066)
     BS_PIPELINE_ROLES            the data-entry carve-out (ADR-051)

   NARROWING ONLY, exactly like company.ts and roles.ts: nothing here grants.
   It reads roles and flags the account already holds and decides which of
   the doors it can ALREADY open get an icon. The server guards stay the wall —
   launcher.integration.test.ts runs every tile's destination page through
   those real guards, per persona, and fails on any redirect at all.

   Pure: no next-auth, no Prisma, no React — the page, the header link and the
   tests import the same functions.
   ========================================================================== */

/** The launcher's own address (outside the proxy matcher — its page guard is
    the only wall, see lib/launcher/guard.ts). */
export const LAUNCHER_PATH = "/apps";
/** The one second-level screen: every report and dashboard, grouped. */
export const REPORTS_PATH = "/apps/reports";

export type AppId =
  | "crm-byteforce"
  | "crm-bsystems"
  | "accounting"
  | "vault"
  | "todo"
  | "reports"
  | "partners";

/** Which palette an icon is drawn in: each CRM in its own brand's colours, the
    cross-company apps in the neutral-led launcher palette. */
export type IconPalette = "byteforce" | "bsystems" | "neutral";

export interface LauncherTile {
  id: AppId;
  href: string;
  label: Msg;
  palette: IconPalette;
}

/* Founder answer 3, "Inside Accounting only": the accounting dashboard, the
   monthly P&L and the department profitability are pages of the Accounting
   app and live in ITS menu (lib/accounting/nav.ts) — not here. This list is
   the two CRM dashboards and the daily report, and nothing else. */
export type ReportId = "bs-dashboard" | "bf-dashboard" | "daily-report";

export interface ReportEntry {
  id: ReportId;
  href: string;
  label: Msg;
  description: Msg;
  group: "crm";
  /** whose data it shows — drawn as a small mark beside the entry */
  palette: IconPalette;
}

/** What every rule here needs: the live roles plus the two module flags —
    exactly the `CurrentUser` fields the guards read on each request. */
export type LauncherBearer = ModuleAccessBearer;

const holdsAny = (roles: Role[], set: readonly Role[]) => roles.some((r) => set.includes(r));

/** The first company — in the shell's own default-first order — in which this
    account holds a role that can WORK leads there. The To-Do and the daily
    report are shared pages that narrow to `crmRolesFor(company)`, so naming
    the company explicitly is what keeps a tile off the one combination that
    would bounce: an account whose only B-Systems role is data entry but who is
    also ByteForce staff would default to B-Systems and be sent away. */
export function workingCompanyFor(roles: Role[]): CrmCompany | null {
  return workingCompaniesFor(roles)[0] ?? null;
}

/** EVERY company in which this account works leads, in the same order. The
    To-Do's in-page company tabs (one To-Do tile, one page, a filter on it)
    render exactly these — two of them means the tabs appear. */
export function workingCompaniesFor(roles: Role[]): CrmCompany[] {
  const held = companiesFor(roles);
  return CRM_COMPANIES.filter((company) => held.includes(company) && holdsAny(roles, crmRolesFor(company)));
}

/** Every report and dashboard this account can open, in reading order. */
export function reportsFor(user: LauncherBearer): ReportEntry[] {
  const roles = user.roles;
  const out: ReportEntry[] = [];
  /* /b-systems under B-Systems renders the dashboard for the admin ONLY —
     every other B-Systems role is redirected to its board (the page's own
     `role !== "bsystems_admin"` bounce). */
  if (roles.includes("bsystems_admin")) {
    out.push({
      id: "bs-dashboard",
      href: `/b-systems${crmQuery("bsystems")}`,
      label: r.bsDashboard,
      description: r.bsDashboardDesc,
      group: "crm",
      palette: "bsystems",
    });
  }
  /* /b-systems under ByteForce is the ByteForce dashboard, and the company
     itself proves byteforce_staff (companiesFor only reports a company a role
     carries) — so holding the company is the whole rule. */
  if (companiesFor(roles).includes("byteforce")) {
    out.push({
      id: "bf-dashboard",
      href: `/b-systems${crmQuery("byteforce")}`,
      label: r.bfDashboard,
      description: r.bfDashboardDesc,
      group: "crm",
      palette: "byteforce",
    });
  }
  /* ONE daily report: it spans every company the account holds (ADR-081 —
     "the company reorders, it does not filter"), so listing it twice would be
     listing the same page twice. */
  const working = workingCompanyFor(roles);
  if (working) {
    out.push({
      id: "daily-report",
      href: `/b-systems/daily-report${crmQuery(working)}`,
      label: r.dailyReport,
      description: r.dailyReportDesc,
      group: "crm",
      palette: "neutral",
    });
  }
  return out;
}

/** Where the Reports & Dashboards tile leads: the second-level screen when
    there is a CHOICE to make, straight to the report when there is only one
    (a sales rep's daily report — a list of one is a click that asks nothing),
    and nowhere at all — no tile — when there is none. */
export function reportsHrefFor(user: LauncherBearer): string | null {
  const entries = reportsFor(user);
  if (entries.length === 0) return null;
  if (entries.length === 1) return entries[0]!.href;
  return REPORTS_PATH;
}

/** The tiles this account sees, in the founder's order. */
export function launcherTilesFor(user: LauncherBearer): LauncherTile[] {
  const roles = user.roles;
  const companies = companiesFor(roles);
  const tiles: LauncherTile[] = [];

  /* 1 — ByteForce CRM: the merged board under ?company=byteforce. Under
     ByteForce the page narrows to nothing beyond the company itself. */
  if (companies.includes("byteforce")) {
    tiles.push({
      id: "crm-byteforce",
      href: `/b-systems/crm${crmQuery("byteforce")}`,
      label: m.crmByteforce,
      palette: "byteforce",
    });
  }

  /* 2 — B-Systems CRM: the board for the four pipeline roles. The data-entry
     account (ADR-051) is refused the board and has exactly ONE destination in
     this CRM — its entry page — so its tile opens THAT, rather than offering a
     board that would bounce it. */
  if (holdsAny(roles, BS_PIPELINE_ROLES)) {
    tiles.push({
      id: "crm-bsystems",
      href: `/b-systems/crm${crmQuery("bsystems")}`,
      label: m.crmBsystems,
      palette: "bsystems",
    });
  } else if (roles.includes("bsystems_data_entry")) {
    tiles.push({
      id: "crm-bsystems",
      href: `/b-systems/entry${crmQuery("bsystems")}`,
      label: m.crmBsystems,
      palette: "bsystems",
    });
  }

  /* 3, 4 — the two MODULES, per admin (ADR-066): the same predicate
     requireModulePage runs, so a blocked admin is never offered the door. */
  if (canUseModule(user, "accounting")) {
    tiles.push({ id: "accounting", href: "/accounting", label: m.accounting, palette: "neutral" });
  }
  if (canUseModule(user, "vault")) {
    tiles.push({ id: "vault", href: "/vault", label: m.vault, palette: "neutral" });
  }

  /* 5 — the To-Do, in the first company where this account works leads */
  const working = workingCompanyFor(roles);
  if (working) {
    tiles.push({
      id: "todo",
      href: `/b-systems/todo${crmQuery(working)}`,
      label: m.todo,
      palette: "neutral",
    });
  }

  /* 6 — Reports & Dashboards: ONE tile for all of them (see reportsHrefFor) */
  const reports = reportsHrefFor(user);
  if (reports) {
    tiles.push({ id: "reports", href: reports, label: m.reports, palette: "neutral" });
  }

  /* 7 — Partners & Agents: ONE app for the pipeline that already carries both
     kinds of card (ADR-059). It opens on the board; the Partners and Agents
     directories and Registrations are in ITS own menu (lib/crm/nav.ts,
     partnersNavFor) — they left the B-Systems CRM menu so each has one way
     in. The board is B-Systems-only and admin-only (requireBsAdminCompanyPage). */
  if (roles.includes("bsystems_admin")) {
    tiles.push({
      id: "partners",
      href: `/b-systems/partners-pipeline${crmQuery("bsystems")}`,
      label: m.partners,
      palette: "neutral",
    });
  }

  return tiles;
}
