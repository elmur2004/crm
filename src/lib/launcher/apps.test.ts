import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  LAUNCHER_PATH,
  REPORTS_PATH,
  launcherTilesFor,
  reportsFor,
  reportsHrefFor,
  workingCompanyFor,
  type LauncherBearer,
} from "./apps";
import { cairoDayPart, greetingFor, greetingName } from "./greeting";
import { canUseModule } from "@/lib/auth/roles";
import { companiesFor, parseCompany } from "@/lib/crm/company";
import { ROLES, type Role } from "@/lib/pipeline-engine/constants";

/* ============================================================================
   THE LAUNCHER — which tiles a person sees, and that every tile is a real page.

   The table tests below state, per persona, the exact grid the founder will
   look at. They are the readable half. The stronger half is
   launcher.integration.test.ts, which renders every tile's DESTINATION through
   the real guards for each persona and fails on any redirect — the property
   "a tile shown to someone who would be refused is a defect", asked of the
   code that does the refusing.
   ========================================================================== */

const person = (
  roles: Role[],
  flags: { canAccessAccounting?: boolean; canAccessVault?: boolean } = {},
): LauncherBearer => ({
  roles,
  canAccessAccounting: flags.canAccessAccounting ?? true,
  canAccessVault: flags.canAccessVault ?? true,
});

const ids = (u: LauncherBearer) => launcherTilesFor(u).map((t) => t.id);
const hrefOf = (u: LauncherBearer, id: string) =>
  launcherTilesFor(u).find((t) => t.id === id)?.href;

/* the seeded accounts, and the one the brief adds (ADR-066's blocked admin) */
const FOUNDER = person(["bsystems_admin", "byteforce_staff"]);
const ADMIN_NO_ACCOUNTING = person(["bsystems_admin"], { canAccessAccounting: false });
const BS_SALES = person(["bsystems_sales"]);
const AGENT = person(["bsystems_agent"]);
const PARTNER = person(["bsystems_partner"]);
const BYTEFORCE_ONLY = person(["byteforce_staff"]);
const DATA_ENTRY = person(["bsystems_data_entry"]);

describe("which tiles each person sees", () => {
  it("the founder (both companies, both modules) sees all seven, in the founder's order", () => {
    expect(ids(FOUNDER)).toEqual([
      "crm-byteforce",
      "crm-bsystems",
      "accounting",
      "vault",
      "todo",
      "reports",
      "partners",
    ]);
    expect(launcherTilesFor(FOUNDER).map((t) => t.href)).toEqual([
      "/b-systems/crm?company=byteforce",
      "/b-systems/crm?company=bsystems",
      "/accounting",
      "/vault",
      "/b-systems/todo?company=bsystems",
      REPORTS_PATH,
      "/b-systems/partners-pipeline?company=bsystems",
    ]);
  });

  it("an admin blocked from Accounting (ADR-066) is not offered Accounting — and keeps the Vault", () => {
    expect(ids(ADMIN_NO_ACCOUNTING)).toEqual([
      "crm-bsystems",
      "vault",
      "todo",
      "reports",
      "partners",
    ]);
    /* and the accounting reports leave the Reports screen with the tile */
    expect(reportsFor(ADMIN_NO_ACCOUNTING).map((r) => r.id)).toEqual(["bs-dashboard", "daily-report"]);
  });

  it("an admin blocked from BOTH modules loses both tiles and nothing else", () => {
    const u = person(["bsystems_admin"], { canAccessAccounting: false, canAccessVault: false });
    expect(ids(u)).toEqual(["crm-bsystems", "todo", "reports", "partners"]);
  });

  it("a B-Systems sales rep: the board, the To-Do, and his daily report — straight to it", () => {
    expect(ids(BS_SALES)).toEqual(["crm-bsystems", "todo", "reports"]);
    /* one report is no choice: the tile opens it rather than a list of one */
    expect(reportsFor(BS_SALES).map((r) => r.id)).toEqual(["daily-report"]);
    expect(hrefOf(BS_SALES, "reports")).toBe("/b-systems/daily-report?company=bsystems");
  });

  it("an agent and a partner see exactly what a sales rep sees — no modules, no Partners & Agents", () => {
    for (const u of [AGENT, PARTNER]) {
      expect(ids(u)).toEqual(["crm-bsystems", "todo", "reports"]);
      expect(hrefOf(u, "reports")).toBe("/b-systems/daily-report?company=bsystems");
    }
  });

  it("a ByteForce-only teammate sees ByteForce only — every href carries company=byteforce", () => {
    expect(ids(BYTEFORCE_ONLY)).toEqual(["crm-byteforce", "todo", "reports"]);
    expect(hrefOf(BYTEFORCE_ONLY, "todo")).toBe("/b-systems/todo?company=byteforce");
    /* two reports — his dashboard and his day — so the Reports screen */
    expect(reportsFor(BYTEFORCE_ONLY).map((r) => r.id)).toEqual(["bf-dashboard", "daily-report"]);
    expect(hrefOf(BYTEFORCE_ONLY, "reports")).toBe(REPORTS_PATH);
    for (const tile of launcherTilesFor(BYTEFORCE_ONLY)) {
      if (tile.href.startsWith("/b-systems")) expect(tile.href).toContain("company=byteforce");
    }
  });

  it("data entry (ADR-051) gets ONE tile — its B-Systems CRM, which is its entry page, never the board", () => {
    expect(launcherTilesFor(DATA_ENTRY)).toEqual([
      expect.objectContaining({ id: "crm-bsystems", href: "/b-systems/entry?company=bsystems" }),
    ]);
    expect(reportsFor(DATA_ENTRY)).toEqual([]);
  });

  it("data entry that is ALSO ByteForce staff works ByteForce's To-Do, not B-Systems'", () => {
    const u = person(["bsystems_data_entry", "byteforce_staff"]);
    expect(workingCompanyFor(u.roles)).toBe("byteforce");
    expect(hrefOf(u, "todo")).toBe("/b-systems/todo?company=byteforce");
    expect(hrefOf(u, "crm-bsystems")).toBe("/b-systems/entry?company=bsystems");
  });

  it("a non-admin is never offered a module, whatever his flags say (the role is the floor)", () => {
    /* `canAccessAccounting = true` is the column default on every row, so the
       flags alone must never be enough — ADR-066's whole point */
    for (const role of ROLES.filter((r) => r !== "bsystems_admin")) {
      const u = person([role]);
      expect(ids(u)).not.toContain("accounting");
      expect(ids(u)).not.toContain("vault");
      expect(ids(u)).not.toContain("partners");
    }
  });

  it("an account with no roles at all has no tiles (the page then sends it to its landing)", () => {
    expect(launcherTilesFor(person([]))).toEqual([]);
  });
});

/* ---------------------------------------------------------------------------
   NARROWING ONLY — over every combination of roles and flags.
   --------------------------------------------------------------------------- */

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

describe("the launcher only ever narrows (all 64 role sets x 4 flag pairs)", () => {
  it("a company in a tile's href is always a company the account holds", () => {
    let checked = 0;
    for (const u of everyBearer()) {
      const held = companiesFor(u.roles);
      for (const href of [...launcherTilesFor(u), ...reportsFor(u)].map((t) => t.href)) {
        const company = parseCompany(new URLSearchParams(href.split("?")[1] ?? "").getAll("company"));
        if (company) {
          expect(held, `${href} offered to [${u.roles.join(", ")}]`).toContain(company);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("the module tiles follow canUseModule exactly — never one without the other", () => {
    for (const u of everyBearer()) {
      expect(ids(u).includes("accounting")).toBe(canUseModule(u, "accounting"));
      expect(ids(u).includes("vault")).toBe(canUseModule(u, "vault"));
    }
  });

  it("no tile is ever repeated, and the Reports tile exists exactly when a report does", () => {
    for (const u of everyBearer()) {
      const list = ids(u);
      expect(new Set(list).size).toBe(list.length);
      expect(list.includes("reports")).toBe(reportsFor(u).length > 0);
      expect(reportsHrefFor(u) === null).toBe(reportsFor(u).length === 0);
    }
  });
});

/* ---------------------------------------------------------------------------
   EVERY HREF RESOLVES TO A PAGE THAT EXISTS.

   The route table is read off the disk — every page.tsx under src/app, route
   groups stripped, dynamic segments as wildcards — so a page renamed or moved
   tomorrow fails this test by name instead of shipping a tile that 404s.
   --------------------------------------------------------------------------- */

const APP = path.join(process.cwd(), "src", "app");

function pageRoutes(dir: string, segments: string[] = []): Array<{ pattern: RegExp; file: string }> {
  const out: Array<{ pattern: RegExp; file: string }> = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      /* (group) folders add nothing to the URL; _private folders are not routes */
      if (entry.startsWith("_")) continue;
      const next = /^\(.*\)$/.test(entry) ? segments : [...segments, entry];
      out.push(...pageRoutes(full, next));
    } else if (entry === "page.tsx") {
      const source = segments
        .map((s) => (/^\[.*\]$/.test(s) ? "[^/]+" : s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))
        .join("/");
      out.push({ pattern: new RegExp(`^/${source}$`), file: path.relative(process.cwd(), full) });
    }
  }
  return out;
}

const ROUTES = pageRoutes(APP);
const pathOf = (href: string) => href.split("?")[0]!.replace(/\/$/, "") || "/";
const resolves = (href: string) => ROUTES.filter((r) => r.pattern.test(pathOf(href)));

describe("every tile's href resolves to a real route", () => {
  it("the route table is real (a silent zero would prove nothing)", () => {
    expect(ROUTES.length).toBeGreaterThan(40);
    /* the launcher's own two pages are in it */
    expect(resolves(LAUNCHER_PATH).map((r) => r.file)).toEqual([
      path.join("src", "app", "(home)", "apps", "page.tsx"),
    ]);
    expect(resolves(REPORTS_PATH).map((r) => r.file)).toEqual([
      path.join("src", "app", "(home)", "apps", "reports", "page.tsx"),
    ]);
    /* and it is not a pattern that matches anything */
    expect(resolves("/b-systems/nowhere")).toEqual([]);
  });

  it("every tile and every report, for every combination of roles and flags, is exactly one page", () => {
    const seen = new Set<string>();
    for (const u of everyBearer()) {
      for (const item of [...launcherTilesFor(u), ...reportsFor(u)]) seen.add(item.href);
    }
    /* the whole destination set, so a new one shows up in review */
    expect([...new Set([...seen].map(pathOf))].sort()).toEqual([
      "/accounting",
      "/accounting/departments",
      "/accounting/report",
      "/apps/reports",
      "/b-systems",
      "/b-systems/crm",
      "/b-systems/daily-report",
      "/b-systems/entry",
      "/b-systems/partners-pipeline",
      "/b-systems/todo",
      "/vault",
    ]);
    for (const href of seen) {
      expect(resolves(href).length, `${href} must resolve to exactly one page.tsx`).toBe(1);
    }
  });
});

/* ---------------------------------------------------------------------------
   THE GREETING — by the hour in Cairo, never the server's.
   --------------------------------------------------------------------------- */

describe("the greeting", () => {
  /* Africa/Cairo is UTC+3 in October 2026 (EEST) and UTC+2 in January */
  it("reads the Cairo hour, not the server's", () => {
    expect(cairoDayPart(new Date("2026-10-25T05:30:00Z"))).toBe("morning"); // 08:30 Cairo
    expect(cairoDayPart(new Date("2026-10-25T10:00:00Z"))).toBe("afternoon"); // 13:00 Cairo
    expect(cairoDayPart(new Date("2026-10-25T15:00:00Z"))).toBe("evening"); // 18:00 Cairo
    /* 23:30 UTC on the 24th is already 02:30 on the 25th in Cairo */
    expect(cairoDayPart(new Date("2026-10-24T23:30:00Z"))).toBe("evening");
    expect(cairoDayPart(new Date("2026-01-15T03:30:00Z"))).toBe("morning"); // 05:30 Cairo, winter
    expect(cairoDayPart(new Date("2026-01-15T02:30:00Z"))).toBe("evening"); // 04:30 Cairo
  });

  it("greets by first name, in both languages", () => {
    expect(greetingName("Sara Hassan")).toBe("Sara");
    expect(greetingFor(new Date("2026-10-25T05:30:00Z"), "Elmur")).toEqual({
      en: "Good morning, Elmur",
      ar: "صباح الخير، Elmur",
    });
    expect(greetingFor(new Date("2026-10-25T15:00:00Z"), "Sara Hassan").en).toBe("Good evening, Sara");
  });

  it("a blank name never leaves a dangling comma", () => {
    expect(greetingFor(new Date("2026-10-25T10:00:00Z"), "  ")).toEqual({
      en: "Good afternoon",
      ar: "مساء الخير",
    });
  });
});
