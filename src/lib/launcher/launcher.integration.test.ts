import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/* ============================================================================
   THE LAUNCHER, THROUGH THE REAL WALLS.

   "A tile that leads to a refusal is a broken promise." apps.test.ts states
   who should see which tile; this file proves the promise against the code
   that would break it. For every persona it signs in for real (a real User
   row in the test Postgres, the session the only stub), renders /apps, and
   then RENDERS EVERY TILE'S DESTINATION — the section's own layout guard and
   the page itself, with the tile's query string — and fails if anything along
   the way redirects. Not "403s": REDIRECTS. A tile that quietly bounces you
   to another screen is the same defect.

   The destinations are the real page modules, imported, not a description of
   them, so a guard tightened tomorrow turns this file red under the tile it
   just broke. Same method as module-access.integration.test.ts: the session
   is mocked by module path; everything else — guards, Prisma, the role and
   flag reads — is the code that runs in production.

   And the launcher's OWN wall: /apps is outside the proxy matcher, so an
   anonymous request must be turned away by the page itself.

   ONE WAY TO EACH PAGE — the same promise for every APP MENU ITEM a person is
   shown (lib/launcher/menus.ts: the two CRM menus, Partners & Agents,
   Accounting, the Vault): each one is rendered, shell and page, and must not
   redirect. A menu item that bounces is a broken promise exactly like a tile.
   ========================================================================== */

const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn<() => Promise<{ user?: { id: string; impersonatorId?: string } } | null>>(),
}));
vi.mock("@/lib/auth/index", () => ({
  auth: authMock,
  /* imported by lib/auth/actions (the Log out form); never called here */
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
}));
/* lib/auth/actions imports AuthError straight from next-auth, whose ESM entry
   cannot load outside Next's bundler; the class is all it needs */
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
/* getLocale / getTheme read the request's cookies; there is no request here —
   an empty jar is a first-time visitor (English, system theme) */
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, getAll: () => [], has: () => false }),
  headers: async () => new Headers(),
}));

import { db } from "@/lib/db";
import { resetDb } from "@/tests/db-reset";
import { launcherTilesFor, reportsFor, REPORTS_PATH } from "./apps";
import { appMenusFor } from "./menus";
import LauncherPage from "@/app/(home)/apps/page";
import ReportsPage from "@/app/(home)/apps/reports/page";

type Role =
  | "bsystems_admin"
  | "bsystems_sales"
  | "bsystems_agent"
  | "bsystems_partner"
  | "bsystems_data_entry"
  | "byteforce_staff";

/* ---- the destinations, as the modules that actually render them ---------- */

/* `never` props: any server component is assignable here, whatever it takes;
   `render` below is the one place the props are handed over */
type Rendered = (props: never) => unknown;
type Loader = () => Promise<{ default: Rendered }>;
const render = (component: Rendered, props: object) =>
  (component as unknown as (p: object) => unknown)(props);

const CRM_SHELL: Loader = () => import("@/app/(bsystems)/b-systems/(app)/layout");
const ACCOUNTING_SHELL: Loader = () => import("@/app/(accounting)/accounting/layout");
const VAULT_SHELL: Loader = () => import("@/app/(vault)/vault/layout");

const DESTINATIONS: Record<string, { shell?: Loader; page: Loader }> = {
  "/b-systems": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/page") },
  "/b-systems/crm": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/crm/page") },
  "/b-systems/entry": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/entry/page") },
  "/b-systems/todo": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/todo/page") },
  "/b-systems/daily-report": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/daily-report/page"),
  },
  "/b-systems/partners-pipeline": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/partners-pipeline/page"),
  },
  /* the app menus' pages (one way to each page — every menu item is rendered too) */
  "/b-systems/leads": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/leads/page") },
  "/b-systems/calendar": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/calendar/page"),
  },
  "/b-systems/clients": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/clients/page"),
  },
  "/b-systems/won-leads": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/won-leads/page"),
  },
  "/b-systems/statements": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/statements/page"),
  },
  "/b-systems/users": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/users/page") },
  "/b-systems/payments": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/payments/page"),
  },
  "/b-systems/profile": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/profile/page"),
  },
  "/b-systems/partners": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/partners/page"),
  },
  "/b-systems/agents": { shell: CRM_SHELL, page: () => import("@/app/(bsystems)/b-systems/(app)/agents/page") },
  "/b-systems/registrations": {
    shell: CRM_SHELL,
    page: () => import("@/app/(bsystems)/b-systems/(app)/registrations/page"),
  },
  "/accounting": { shell: ACCOUNTING_SHELL, page: () => import("@/app/(accounting)/accounting/page") },
  "/accounting/income": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/income/page"),
  },
  "/accounting/expenses": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/expenses/page"),
  },
  "/accounting/clients": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/clients/page"),
  },
  "/accounting/roster": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/roster/page"),
  },
  "/accounting/media": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/media/page"),
  },
  "/accounting/loans": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/loans/page"),
  },
  "/accounting/treasury": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/treasury/page"),
  },
  "/accounting/report": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/report/page"),
  },
  "/accounting/departments": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/departments/page"),
  },
  "/accounting/targets": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/targets/page"),
  },
  "/accounting/import": {
    shell: ACCOUNTING_SHELL,
    page: () => import("@/app/(accounting)/accounting/import/page"),
  },
  "/vault": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/page") },
  "/vault/forms": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/forms/page") },
  "/vault/links": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/links/page") },
  "/vault/sheets": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/sheets/page") },
  "/vault/documents": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/documents/page") },
  "/vault/tasks": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/tasks/page") },
  "/vault/employees": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/employees/page") },
  "/vault/archive": { shell: VAULT_SHELL, page: () => import("@/app/(vault)/vault/archive/page") },
  [REPORTS_PATH]: { page: () => import("@/app/(home)/apps/reports/page") },
};

/** Run a server render; return where it REDIRECTED, or null if it rendered.
    Anything else it throws is a real failure and propagates. */
async function redirectOf(render: () => unknown): Promise<string | null> {
  try {
    await render();
    return null;
  } catch (err) {
    const digest = (err as { digest?: unknown }).digest;
    const match = typeof digest === "string" ? /^NEXT_REDIRECT;[^;]*;([^;]*);/.exec(digest) : null;
    if (match) return match[1]!;
    throw err;
  }
}

/** Render a tile's destination exactly as a navigation would: the section's
    layout guard first, then the page, both with the href's own query. */
async function visit(href: string): Promise<string | null> {
  const [pathname, query = ""] = href.split("?");
  const dest = DESTINATIONS[pathname!];
  if (!dest) throw new Error(`${href}: no destination registered — add its page module to DESTINATIONS`);
  const searchParams = Object.fromEntries(new URLSearchParams(query));
  if (dest.shell) {
    const Shell = (await dest.shell()).default;
    const bounced = await redirectOf(() => render(Shell, { children: null }));
    if (bounced) return bounced;
  }
  const Page = (await dest.page()).default;
  return redirectOf(() => render(Page, { searchParams: Promise.resolve(searchParams) }));
}

/* ---- the personas -------------------------------------------------------- */

let seq = 0;
async function makeUser(
  name: string,
  roles: Role[],
  extra: {
    canAccessAccounting?: boolean;
    canAccessVault?: boolean;
    active?: boolean;
    registrationStatus?: string;
  } = {},
) {
  return db.user.create({
    data: {
      name,
      phone: `+2010777000${String(seq++).padStart(2, "0")}`,
      passwordHash: "x",
      ...extra,
      roles: { create: roles.map((role) => ({ role })) },
    },
    include: { roles: true },
  });
}

type Persona = Awaited<ReturnType<typeof makeUser>>;
const personas: Record<string, Persona> = {};

const signInAs = (user: { id: string } | null) =>
  authMock.mockResolvedValue(user ? { user: { id: user.id } } : null);

const bearer = (p: Persona) => ({
  roles: p.roles.map((r) => r.role as Role),
  canAccessAccounting: p.canAccessAccounting,
  canAccessVault: p.canAccessVault,
});

beforeAll(async () => {
  await resetDb();
  personas.founder = await makeUser("Elmur", ["bsystems_admin", "byteforce_staff"]);
  personas.adminNoAccounting = await makeUser("Blocked Admin", ["bsystems_admin"], {
    canAccessAccounting: false,
  });
  personas.adminNoModules = await makeUser("Bare Admin", ["bsystems_admin"], {
    canAccessAccounting: false,
    canAccessVault: false,
  });
  personas.bsSales = await makeUser("Omar Farouk", ["bsystems_sales"]);
  personas.agent = await makeUser("Karim Adel", ["bsystems_agent"]);
  /* every real agent account carries its profile (sign-up and PP-4a both
     write one); his menu's Profile page reads it */
  await db.portalRep.create({
    data: { userId: personas.agent.id, firstName: "Karim", lastName: "Adel", address: "Cairo", speciality: "Sales" },
  });
  personas.partner = await makeUser("Partner Co", ["bsystems_partner"]);
  personas.byteforceOnly = await makeUser("Sara Hassan", ["byteforce_staff"]);
  personas.dataEntry = await makeUser("Hala Nabil", ["bsystems_data_entry"]);
  personas.dataEntryPlusByteforce = await makeUser("Two Hats", ["bsystems_data_entry", "byteforce_staff"]);
});

beforeEach(() => {
  authMock.mockReset();
});

/* -------------------------------------------------------------------------- */

describe("the launcher's own wall — /apps is outside the proxy, so the page is the guard", () => {
  it("an anonymous request to /apps is redirected to /login", async () => {
    signInAs(null);
    expect(await redirectOf(() => LauncherPage())).toBe("/login");
  });

  it("an anonymous request to /apps/reports is redirected to /login", async () => {
    signInAs(null);
    expect(await redirectOf(() => ReportsPage())).toBe("/login");
  });

  it("a deactivated account and a pending signup are turned away the same way", async () => {
    const gone = await makeUser("Former Staff", ["bsystems_admin"], { active: false });
    const pending = await makeUser("Waiting Agent", ["bsystems_agent"], { registrationStatus: "pending" });
    for (const user of [gone, pending]) {
      signInAs(user);
      expect(await redirectOf(() => LauncherPage())).toBe("/login");
      expect(await redirectOf(() => ReportsPage())).toBe("/login");
    }
  });

  it("a session for a user that no longer exists is turned away", async () => {
    signInAs({ id: "no-such-user" });
    expect(await redirectOf(() => LauncherPage())).toBe("/login");
  });

  it("an account with no app at all is not shown an empty grid — it goes to its landing", async () => {
    const nobody = await makeUser("No Roles", []);
    signInAs(nobody);
    expect(await redirectOf(() => LauncherPage())).toBe("/login?error=1");
  });
});

const NAMES = [
  "founder",
  "adminNoAccounting",
  "adminNoModules",
  "bsSales",
  "agent",
  "partner",
  "byteforceOnly",
  "dataEntry",
  "dataEntryPlusByteforce",
] as const;

describe("every tile a person is shown opens for that person — no redirect anywhere", () => {
  it.each(NAMES)("%s: the launcher renders, and every tile lands where it says", async (name) => {
    const p = personas[name]!;
    signInAs(p);
    expect(await redirectOf(() => LauncherPage()), "the launcher itself").toBeNull();

    const tiles = launcherTilesFor(bearer(p));
    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      signInAs(p);
      expect(await visit(tile.href), `${name} → ${tile.id} (${tile.href})`).toBeNull();
    }
  });

  it.each(NAMES)("%s: every entry on the Reports screen lands where it says", async (name) => {
    const p = personas[name]!;
    const entries = reportsFor(bearer(p));
    for (const entry of entries) {
      signInAs(p);
      expect(await visit(entry.href), `${name} → ${entry.id} (${entry.href})`).toBeNull();
    }
    /* and the Reports screen itself: shown to anyone with a report, and the
       way back to the grid for anyone without one */
    signInAs(p);
    expect(await redirectOf(() => ReportsPage())).toBe(entries.length > 0 ? null : "/apps");
  });

  it.each(NAMES)("%s: every item of every app menu he is shown opens — no redirect anywhere", async (name) => {
    const p = personas[name]!;
    const menus = appMenusFor(bearer(p));
    let items = 0;
    for (const [app, hrefs] of Object.entries(menus)) {
      if (app === "reports") continue; // the Reports list: the case above
      for (const href of hrefs!) {
        items++;
        signInAs(p);
        expect(await visit(href), `${name} → ${app} menu → ${href}`).toBeNull();
      }
    }
    /* data entry's one app has no menu; everybody else has items to prove */
    if (name !== "dataEntry") expect(items, name).toBeGreaterThan(0);
  });
});

describe("the doors the launcher does NOT show are doors the walls really shut", () => {
  /* The converse, on the exact screens the launcher withholds — so a missing
     tile is a missing permission, not an oversight. */
  it("the blocked admin's Accounting is refused by the real guard", async () => {
    signInAs(personas.adminNoAccounting!);
    expect(await visit("/accounting")).toBe("/no-access?module=accounting");
  });

  it("a sales rep sent to Partners & Agents, or to the admin dashboard, is bounced", async () => {
    signInAs(personas.bsSales!);
    expect(await visit("/b-systems/partners-pipeline?company=bsystems")).not.toBeNull();
    signInAs(personas.bsSales!);
    expect(await visit("/b-systems?company=bsystems")).not.toBeNull();
  });

  it("data entry sent to the B-Systems board is bounced to its one page", async () => {
    signInAs(personas.dataEntry!);
    expect(await visit("/b-systems/crm?company=bsystems")).toBe("/b-systems/entry");
  });

  it("a ByteForce-only teammate sent to B-Systems is bounced to his own company", async () => {
    signInAs(personas.byteforceOnly!);
    expect(await visit("/b-systems/crm?company=bsystems")).toBe("/b-systems?company=byteforce");
  });

  it("a non-admin sent to a Partners & Agents screen is bounced — the menu is the admin's alone", async () => {
    for (const href of [
      "/b-systems/partners?company=bsystems",
      "/b-systems/agents?company=bsystems",
      "/b-systems/registrations?company=bsystems",
    ]) {
      signInAs(personas.bsSales!);
      expect(await visit(href), href).not.toBeNull();
    }
  });
});

describe("one way to each page — where a page bounce lands", () => {
  /* landingFor is only a fallback now (sign-in lands on the launcher): a
     signed-in account refused a section is sent to its BOARD, never to the
     dashboard, which is a page of Reports & Dashboards */
  it("the admin refused a section lands on his board, and the board renders for him", async () => {
    signInAs(personas.founder!);
    /* Payments is the agent's and the partner's alone */
    expect(await visit("/b-systems/payments?company=bsystems")).toBe("/b-systems/crm?company=bsystems");
    signInAs(personas.founder!);
    expect(await visit("/b-systems/crm?company=bsystems")).toBeNull();
    /* and an admin-only page bounces a non-admin to his board too */
    signInAs(personas.bsSales!);
    expect(await visit("/b-systems/users?company=bsystems")).toBe("/b-systems/crm");
  });

  it("an account with no app at all is sent to the sign-in page's error, unchanged", async () => {
    const nobody = await makeUser("Still Nobody", []);
    signInAs(nobody);
    expect(await redirectOf(() => LauncherPage())).toBe("/login?error=1");
  });
});
