import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";
import { LAUNCHER_PATH, REPORTS_PATH, launcherTilesFor, reportsFor, type LauncherBearer } from "./apps";
import { appMenusFor, doorsFor, pageKey } from "./menus";

/* ============================================================================
   ONE WAY TO EACH PAGE — the guard.

   Founder: "there is multiple ways to get to each page there should be one way
   each for each page to get to".

   The rule, as the approved spec states it: the launcher (/apps) is the only
   way BETWEEN apps; each app's own menu is the only way to its pages; content
   links to RECORDS stay (they are the only way to a record); same-page
   controls (filters, clear, tabs, prev/next, a range) are not navigation.

   So, for every account there can be, every page has AT MOST ONE menu-level
   door: a launcher tile, a Reports & Dashboards entry, or an item of an app's
   own menu — the CRM menus and Partners & Agents (lib/crm/nav.ts), Accounting
   (lib/accounting/nav.ts), the Vault (lib/services/vault/nav.ts). A tile that
   opens its app on the app's own first menu item is the door to that APP, not
   a second door to the page (lib/launcher/menus.ts says why).

   A future duplicate — the dashboard back in a CRM menu, a To-Do item in a
   menu as well as its tile, an accounting report back on the Reports list, a
   page in two menus — fails here, by name.
   ========================================================================== */

const person = (
  roles: Role[],
  flags: { canAccessAccounting?: boolean; canAccessVault?: boolean } = {},
): LauncherBearer => ({
  roles,
  canAccessAccounting: flags.canAccessAccounting ?? true,
  canAccessVault: flags.canAccessVault ?? true,
});

/* the personas apps.test.ts and launcher.integration.test.ts model */
const PERSONAS: Record<string, LauncherBearer> = {
  founder: person(["bsystems_admin", "byteforce_staff"]),
  adminNoAccounting: person(["bsystems_admin"], { canAccessAccounting: false }),
  adminNoModules: person(["bsystems_admin"], { canAccessAccounting: false, canAccessVault: false }),
  bsSales: person(["bsystems_sales"]),
  agent: person(["bsystems_agent"]),
  partner: person(["bsystems_partner"]),
  byteforceOnly: person(["byteforce_staff"]),
  dataEntry: person(["bsystems_data_entry"]),
  dataEntryPlusByteforce: person(["bsystems_data_entry", "byteforce_staff"]),
};

function* everyBearer(): Generator<LauncherBearer> {
  for (let mask = 0; mask < 1 << ROLES.length; mask++) {
    const roles = ROLES.filter((_, i) => mask & (1 << i));
    for (const canAccessAccounting of [true, false]) {
      for (const canAccessVault of [true, false]) {
        yield { roles: [...roles], canAccessAccounting, canAccessVault };
      }
    }
  }
}

const describeDoors = (doors: Array<{ app: string; kind: string }>) =>
  doors.map((d) => `${d.app} ${d.kind}`).join(" + ");

/* ------------------------------------------------------------ the property */

describe("every page has at most ONE menu-level way in", () => {
  it.each(Object.keys(PERSONAS))("%s", (name) => {
    const doors = doorsFor(PERSONAS[name]!);
    expect(doors.size, `${name} has no doors at all`).toBeGreaterThan(0);
    for (const [page, ways] of doors) {
      expect(ways.length, `${name}: ${page} is reached ${ways.length} ways (${describeDoors(ways)})`).toBe(1);
    }
  });

  it("…for every combination of roles and module flags (64 role sets × 4 flag pairs)", () => {
    let pages = 0;
    for (const u of everyBearer()) {
      for (const [page, ways] of doorsFor(u)) {
        pages++;
        expect(
          ways.length,
          `[${u.roles.join(", ")}] acct=${u.canAccessAccounting} vault=${u.canAccessVault}: ` +
            `${page} is reached ${ways.length} ways (${describeDoors(ways)})`,
        ).toBe(1);
      }
    }
    expect(pages).toBeGreaterThan(1000); // a silent zero would prove nothing
  });

  it("a tile opens its app on the app's FIRST menu item — or the app has no menu (one page)", () => {
    for (const u of everyBearer()) {
      const menus = appMenusFor(u);
      for (const tile of launcherTilesFor(u)) {
        const menu = (menus[tile.id] ?? []).map(pageKey);
        if (tile.id === "reports") {
          /* Reports & Dashboards: its "menu" is the list itself — the tile
             opens the list, or the one report when there is only one */
          expect(menu.length === 1 ? menu[0] : REPORTS_PATH, tile.href).toBe(pageKey(tile.href));
          continue;
        }
        if (menu.length === 0) continue; // the To-Do, data entry: one page, no menu
        expect(menu[0], `${tile.id} opens ${tile.href}, not its menu's first item`).toBe(pageKey(tile.href));
      }
    }
  });

  it("no app's menu lists the same page twice", () => {
    for (const u of everyBearer()) {
      for (const [app, items] of Object.entries(appMenusFor(u))) {
        const keys = items!.map(pageKey);
        expect(new Set(keys).size, `${app} for [${u.roles.join(", ")}]`).toBe(keys.length);
      }
    }
  });

  it("the guard really counts: a page put back in a second menu is caught", () => {
    /* the counter's own self-test — the shapes this pass removed, re-added by
       hand, must each come out as two doors */
    const founder = PERSONAS.founder!;
    const menus = appMenusFor(founder);
    const count = (extra: Record<string, string[]>, page: string) => {
      const all: Record<string, string[]> = { ...(menus as Record<string, string[]>) };
      for (const [app, items] of Object.entries(extra)) all[app] = [...(all[app] ?? []), ...items];
      let n = 0;
      for (const items of Object.values(all)) n += items.map(pageKey).filter((k) => k === pageKey(page)).length;
      for (const tile of launcherTilesFor(founder)) {
        const own = (all[tile.id] ?? []).map(pageKey);
        if (!own.includes(pageKey(tile.href)) && pageKey(tile.href) === pageKey(page)) n++;
      }
      return n;
    };
    /* the To-Do back in the B-Systems CRM menu: its tile + the menu item */
    expect(count({ "crm-bsystems": ["/b-systems/todo?company=bsystems"] }, "/b-systems/todo?company=bsystems")).toBe(2);
    /* the dashboard back in the CRM menu as "Home": the Reports entry + the item */
    expect(count({ "crm-bsystems": ["/b-systems?company=bsystems"] }, "/b-systems?company=bsystems")).toBe(2);
    /* the accounting P&L back on the Reports list: the Accounting item + the entry */
    expect(count({ reports: ["/accounting/report"] }, "/accounting/report")).toBe(2);
  });
});

/* -------------------------------------------- the menus, per persona, as shown */

describe("the menu-level doors each persona is shown (the founder's table)", () => {
  const strip = (hrefs: string[] | undefined) => (hrefs ?? []).map(pageKey);

  it("the founder", () => {
    const m = appMenusFor(PERSONAS.founder!);
    expect(Object.keys(m)).toEqual([
      "crm-byteforce",
      "crm-bsystems",
      "partners",
      "accounting",
      "vault",
      "todo",
      "reports",
    ]);
    expect(strip(m["crm-byteforce"])).toEqual([
      "/b-systems/crm?company=byteforce",
      "/b-systems/leads?company=byteforce",
      "/b-systems/calendar?company=byteforce",
      "/b-systems/clients?company=byteforce",
    ]);
    expect(strip(m["crm-bsystems"])).toEqual([
      "/b-systems/crm?company=bsystems",
      "/b-systems/leads?company=bsystems",
      "/b-systems/calendar?company=bsystems",
      "/b-systems/won-leads?company=bsystems",
      "/b-systems/statements?company=bsystems",
      "/b-systems/users?company=bsystems",
    ]);
    expect(strip(m.partners)).toEqual([
      "/b-systems/partners-pipeline?company=bsystems",
      "/b-systems/partners?company=bsystems",
      "/b-systems/agents?company=bsystems",
      "/b-systems/registrations?company=bsystems",
    ]);
    expect(m.accounting).toEqual([
      "/accounting",
      "/accounting/income",
      "/accounting/expenses",
      "/accounting/clients",
      "/accounting/roster",
      "/accounting/media",
      "/accounting/loans",
      "/accounting/treasury",
      "/accounting/report",
      "/accounting/departments",
      "/accounting/targets",
      "/accounting/import",
    ]);
    expect(m.vault).toEqual([
      "/vault",
      "/vault/forms",
      "/vault/links",
      "/vault/sheets",
      "/vault/documents",
      "/vault/tasks",
      "/vault/employees",
      "/vault/archive",
    ]);
    expect(m.todo).toEqual([]);
    expect(m.reports).toEqual([
      "/b-systems?company=bsystems",
      "/b-systems?company=byteforce",
      "/b-systems/daily-report?company=bsystems",
    ]);
  });

  it("a B-Systems sales rep, an agent, a partner", () => {
    expect(strip(appMenusFor(PERSONAS.bsSales!)["crm-bsystems"])).toEqual([
      "/b-systems/crm?company=bsystems",
      "/b-systems/calendar?company=bsystems",
      "/b-systems/won-leads?company=bsystems",
    ]);
    for (const name of ["agent", "partner"]) {
      const m = appMenusFor(PERSONAS[name]!);
      expect(Object.keys(m), name).toEqual(["crm-bsystems", "todo", "reports"]);
      expect(strip(m["crm-bsystems"])).toEqual([
        "/b-systems/crm?company=bsystems",
        "/b-systems/calendar?company=bsystems",
        "/b-systems/won-leads?company=bsystems",
        "/b-systems/payments?company=bsystems",
        "/b-systems/profile?company=bsystems",
      ]);
      /* his one report, which the Reports tile opens directly */
      expect(m.reports).toEqual(["/b-systems/daily-report?company=bsystems"]);
    }
  });

  it("a ByteForce-only teammate", () => {
    const m = appMenusFor(PERSONAS.byteforceOnly!);
    expect(Object.keys(m)).toEqual(["crm-byteforce", "todo", "reports"]);
    expect(m.reports).toEqual(["/b-systems?company=byteforce", "/b-systems/daily-report?company=byteforce"]);
  });

  it("data entry: one tile, no menu at all", () => {
    expect(appMenusFor(PERSONAS.dataEntry!)).toEqual({ "crm-bsystems": [] });
    const doors = doorsFor(PERSONAS.dataEntry!);
    expect([...doors.keys()]).toEqual(["/b-systems/entry?company=bsystems"]);
  });
});

/* ------------------------------------------------- no orphaned section page */

const APP = path.join(process.cwd(), "src", "app");

/** Every STATIC page of the app shells and the launcher, as a path. Pages with
    a [dynamic] segment are RECORDS — reached from the screen that lists them. */
function staticPages(dir: string, segments: string[] = []): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry.startsWith("_") || /^\[.*\]$/.test(entry)) continue;
      out.push(...staticPages(full, /^\(.*\)$/.test(entry) ? segments : [...segments, entry]));
    } else if (entry === "page.tsx") {
      out.push(`/${segments.join("/")}`);
    }
  }
  return out;
}

describe("every section page still has a way in — none orphaned", () => {
  const SECTIONS = [
    ...staticPages(path.join(APP, "(bsystems)", "b-systems", "(app)"), ["b-systems"]),
    ...staticPages(path.join(APP, "(accounting)")),
    ...staticPages(path.join(APP, "(vault)")),
    REPORTS_PATH,
  ];

  it("the section list is real", () => {
    expect(SECTIONS.length).toBeGreaterThan(35);
    expect(SECTIONS).toContain("/b-systems/partners-pipeline");
    expect(SECTIONS).toContain("/accounting/report");
  });

  it("each one is behind a menu-level door for SOMEBODY", () => {
    const reached = new Set<string>();
    for (const u of everyBearer()) for (const key of doorsFor(u).keys()) reached.add(key.split("?")[0]!);
    for (const page of SECTIONS) expect(reached.has(page), `${page} has no way in for anybody`).toBe(true);
  });

  it("and every door leads to a section page that exists", () => {
    const sections = new Set(SECTIONS);
    for (const u of everyBearer()) {
      for (const key of doorsFor(u).keys()) expect(sections.has(key.split("?")[0]!), key).toBe(true);
    }
  });
});

/* -------------------------------------------- the removed controls are GONE */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(tsx?|css)$/.test(entry) && !/\.test\.ts$/.test(entry)) out.push(full);
  }
  return out;
}

const SHELLS = [
  "src/app/(bsystems)/b-systems/(app)/layout.tsx",
  "src/app/(accounting)/accounting/layout.tsx",
  "src/app/(vault)/vault/layout.tsx",
];

describe("the controls one-way-in removed are gone, not hidden", () => {
  it("the module switcher, its phone bar and the company switch no longer exist", () => {
    for (const file of [
      "src/components/shared/EntitySwitch.tsx",
      "src/components/shared/CompanySwitch.tsx",
      "src/lib/crm/switch-target.ts",
    ]) {
      expect(existsSync(path.join(process.cwd(), file)), `${file} is back`).toBe(false);
    }
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      const rel = path.relative(process.cwd(), file);
      for (const name of [
        "EntitySwitch",
        "CompanySwitch",
        "CrmHomeLink",
        "switch-target",
        "switcher--bar",
        "switcher-entity",
        "company-switch",
      ]) {
        expect(code.includes(name), `${rel} still names ${name}`).toBe(false);
      }
    }
  });

  it("no shell header's mark is a link — the grid icon is the one way back to the launcher", () => {
    for (const shell of SHELLS) {
      const code = read(shell);
      expect(code, shell).not.toMatch(/from "next\/link"/);
      expect(code, shell).not.toMatch(/app-home-link/);
      expect(code, shell).toMatch(/<LauncherHomeLink locale=\{locale\} \/>/);
      expect(code, shell).toMatch(/className="app-mark/);
    }
    /* the launcher's own lockup is not a link either */
    const chrome = read("src/components/launcher/LauncherChrome.tsx");
    expect(chrome).not.toMatch(/from "next\/link"/);
    expect(chrome).toMatch(/<span className="lx-brand">/);
  });

  it("the launcher's way back from Reports & Dashboards is its one All apps link", () => {
    const code = read("src/app/(home)/apps/reports/page.tsx");
    expect(code.match(/href=\{LAUNCHER_PATH\}/g)?.length).toBe(1);
    expect(LAUNCHER_PATH).toBe("/apps");
  });
});

/* --------------------------- no content link repeats a menu (founder: "Remove them") */

/** Every menu-level page there is, as a bare path. */
function menuPages(): Set<string> {
  const pages = new Set<string>();
  for (const u of everyBearer()) {
    for (const key of doorsFor(u).keys()) pages.add(key.split("?")[0]!);
    for (const r of reportsFor(u)) pages.add(pageKey(r.href).split("?")[0]!);
  }
  return pages;
}

/* SAME-PAGE controls that carry their own page's address — not navigation:
   a "Clear filters", a view toggle, a scope tab, a range. Each is listed with
   the one path it may name, in the one file that renders that page. */
const SAME_PAGE: Record<string, string[]> = {
  "src/components/bsystems/pages/BsCrmBoardBody.tsx": ["/b-systems/crm"],
  "src/components/bsystems/pages/BsLeadsBody.tsx": ["/b-systems/leads"],
  "src/components/internal/pages.tsx": ["/b-systems/crm"],
  "src/components/partners/pages.tsx": ["/b-systems/partners-pipeline"],
  "src/components/dashboard/RangePicker.tsx": ["/b-systems"],
  "src/app/(bsystems)/b-systems/(app)/agents/page.tsx": ["/b-systems/agents"],
  "src/app/(accounting)/accounting/clients/page.tsx": ["/accounting/clients"],
  "src/app/(accounting)/accounting/departments/page.tsx": ["/accounting/departments"],
  "src/app/(vault)/vault/links/page.tsx": ["/vault/links"],
};

/** The path an `href` literal names, or null when it names a RECORD (a
    dynamic segment) or something that is not an app page. */
function literalPath(raw: string): string | null {
  const s = raw.replace(/\$\{ctx\.basePath\}/g, "/b-systems");
  const dyn = s.indexOf("${");
  const head = dyn >= 0 ? s.slice(0, dyn) : s;
  if (dyn >= 0 && (head.endsWith("/") || head === "")) return null; // a record id, or wholly dynamic
  const p = head.split("?")[0]!.replace(/\/+$/, "") || "/";
  return /^\/(b-systems|accounting|vault|apps)(\/|$)/.test(p) ? p : null;
}

describe("no content link repeats a menu-level way in", () => {
  const SKIP = /[\\/](landing|login)[\\/]|[\\/]\(landing\)[\\/]/;
  const files = [
    ...sourceFiles(path.join(process.cwd(), "src", "components")),
    ...sourceFiles(path.join(process.cwd(), "src", "app")),
  ].filter((f) => f.endsWith(".tsx") && !SKIP.test(f));
  const MENU_PAGES = menuPages();

  it("the sweep is real", () => {
    expect(files.length).toBeGreaterThan(80);
    expect(MENU_PAGES.has("/b-systems/crm")).toBe(true);
    expect(literalPath("${ctx.basePath}/crm${ctx.query}")).toBe("/b-systems/crm");
    expect(literalPath("/b-systems/crm/lead/${lead.id}${ctx.query}")).toBeNull();
    expect(literalPath("/accounting/import${acctQuery(view)}")).toBe("/accounting/import");
  });

  it("every literal href to a menu page is that page's own same-page control", () => {
    for (const file of files) {
      const rel = path.relative(process.cwd(), file).split(path.sep).join("/");
      const code = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      for (const m of code.matchAll(/href=\{?\s*(["'`])(.*?)\1/g)) {
        const p = literalPath(m[2]!);
        if (!p || !MENU_PAGES.has(p)) continue;
        expect(
          SAME_PAGE[rel] ?? [],
          `${rel} links to ${p}, a page that is already in a menu — remove it (one way to each page), ` +
            "or, if it is a control on that same page, list it in SAME_PAGE",
        ).toContain(p);
      }
    }
  });
});
