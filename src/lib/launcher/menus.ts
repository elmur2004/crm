import { canUseModule } from "@/lib/auth/roles";
import { bsRoleOrNull } from "@/lib/api/bsystems";
import { accountingNavFor } from "@/lib/accounting/nav";
import type { AcctCompany } from "@/lib/accounting/constants";
import { companiesFor, crmQuery } from "@/lib/crm/company";
import { crmNavFor, partnersNavFor, PARTNERS_COMPANY } from "@/lib/crm/nav";
import { moduleCompaniesFor } from "@/lib/module-companies";
import { VAULT_SECTIONS } from "@/lib/services/vault/nav";
import { launcherTilesFor, reportsFor, type AppId, type LauncherBearer } from "./apps";

/* ============================================================================
   ONE WAY TO EACH PAGE — every MENU-LEVEL way in, for one account.

   Founder: "there is multiple ways to get to each page there should be one way
   each for each page to get to".

   The launcher (/apps) is the only way BETWEEN apps; each app's own menu is the
   only way to its pages. This file puts the two together — the launcher tiles
   (lib/launcher/apps.ts), the Reports & Dashboards list (the Reports app's
   menu), and every app's header menu (lib/crm/nav.ts for the two CRMs and
   Partners & Agents, lib/accounting/nav.ts, lib/services/vault/nav.ts) — so
   one-way.test.ts can count, per page, how many doors lead to it.

   A TILE IS THE DOOR TO ITS APP, not a second door to the page it opens: the
   ByteForce CRM tile opens the board, and the board is that app's first menu
   item — one way in, entered through its app. A tile counts as a door of its
   own only when its app has no menu item for the page it opens (the To-Do,
   the data-entry page, the Reports screen itself).

   Pure: the same functions the launcher, the shells and the tests call.
   Content links to RECORDS are deliberately not here — a lead, a deal, a
   partner is reached from the screen that lists it, which is the only way to
   reach it at all (founder answer 4).
   ========================================================================== */

/** Every app's menu, as full hrefs. An app the account cannot open is absent;
    an app with no menu (the To-Do) has an empty list. */
export type AppMenus = Partial<Record<AppId, string[]>>;

export function appMenusFor(user: LauncherBearer): AppMenus {
  const roles = user.roles;
  const companies = companiesFor(roles);
  const tiles = new Set(launcherTilesFor(user).map((t) => t.id));
  const bsRole = bsRoleOrNull({ roles });
  const menus: AppMenus = {};

  if (tiles.has("crm-byteforce") && companies.includes("byteforce")) {
    menus["crm-byteforce"] = crmNavFor("byteforce", null).map((i) => `${i.href}${crmQuery("byteforce")}`);
  }
  if (tiles.has("crm-bsystems") && companies.includes("bsystems")) {
    menus["crm-bsystems"] = crmNavFor("bsystems", bsRole).map((i) => `${i.href}${crmQuery("bsystems")}`);
  }
  if (tiles.has("partners")) {
    menus.partners = partnersNavFor(bsRole).map((i) => `${i.href}${crmQuery(PARTNERS_COMPANY)}`);
  }
  if (tiles.has("accounting") && canUseModule(user, "accounting")) {
    /* one app, a company FILTER on it: every company's tabs are the same pages */
    const hrefs = moduleCompaniesFor(roles).flatMap((c) =>
      accountingNavFor(c as AcctCompany).map((i) => i.href),
    );
    menus.accounting = [...new Set(hrefs)];
  }
  if (tiles.has("vault") && canUseModule(user, "vault")) {
    menus.vault = VAULT_SECTIONS.map((i) => i.href);
  }
  if (tiles.has("todo")) menus.todo = [];
  if (tiles.has("reports")) menus.reports = reportsFor(user).map((r) => r.href);
  return menus;
}

/** A page's identity. Under /b-systems the COMPANY is part of it — the two
    CRMs are two apps, so `/b-systems/crm?company=byteforce` and
    `?company=bsystems` are two boards. In Accounting and the Vault it is a
    filter on one page (ADR-054), so it is not. */
export function pageKey(href: string): string {
  const [rawPath, query = ""] = href.split("?");
  const path = rawPath!.replace(/\/+$/, "") || "/";
  if (!path.startsWith("/b-systems")) return path;
  const company = new URLSearchParams(query).get("company");
  return company ? `${path}?company=${company}` : path;
}

export interface Door {
  /** the app whose tile or menu it is */
  app: AppId;
  kind: "menu" | "tile";
}

/** Every menu-level door to every page, for one account. */
export function doorsFor(user: LauncherBearer): Map<string, Door[]> {
  const menus = appMenusFor(user);
  const doors = new Map<string, Door[]>();
  const add = (href: string, door: Door) => {
    const key = pageKey(href);
    doors.set(key, [...(doors.get(key) ?? []), door]);
  };
  for (const [app, items] of Object.entries(menus) as Array<[AppId, string[]]>) {
    for (const href of items) add(href, { app, kind: "menu" });
  }
  for (const tile of launcherTilesFor(user)) {
    const own = (menus[tile.id] ?? []).map(pageKey);
    /* the tile enters its app on one of the app's own menu items: the same way
       in, not a second one */
    if (!own.includes(pageKey(tile.href))) add(tile.href, { app: tile.id, kind: "tile" });
  }
  return doors;
}
