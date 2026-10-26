import { expect, type Page } from "@playwright/test";

/* ADR-090 — every account now lands on the app launcher (/apps) after signing
   in (founder: "Home after sign-in"). The specs were written against the old
   role landing, so after the Sign-in click they call this: it proves the
   launcher really was the landing, then opens the page the spec goes on to
   test and checks it is the one the spec expected.

   ONE WAY TO EACH PAGE (founder: "there is multiple ways to get to each page
   there should be one way each for each page to get to"). Each page a spec
   starts on is listed WITH the launcher tile that is its one way in — the CRM
   boards behind their CRM tiles, the dashboards behind Reports & Dashboards
   (they left the CRM menus), the data-entry page behind its B-Systems CRM
   tile — and the helper checks that tile is on the account's launcher before
   it opens the page. A spec can therefore never start on a page its account
   has no way to reach.

   The table is STRICT on purpose: a landing it does not know throws, so a new
   spec cannot silently land somewhere it never asserted. */

export const LAUNCHER_URL = /\/apps(\?|$)/;

interface Landing {
  /** the page the spec starts on */
  path: string;
  /** the launcher tile (data-app) that is that page's one menu-level way in */
  via: "crm-bsystems" | "crm-byteforce" | "reports";
}

const LANDING_PATHS: Record<string, Landing> = {
  /* the B-Systems dashboard — a page of Reports & Dashboards */
  "\\/b-systems$": { path: "/b-systems", via: "reports" },
  /* the ByteForce dashboard — likewise */
  "\\/b-systems\\?company=byteforce$": { path: "/b-systems?company=byteforce", via: "reports" },
  /* the B-Systems board — the B-Systems CRM tile */
  "\\/b-systems\\/crm$": { path: "/b-systems/crm", via: "crm-bsystems" },
  "\\/b-systems\\/crm": { path: "/b-systems/crm", via: "crm-bsystems" },
  /* the data-entry page — that role's B-Systems CRM tile */
  "\\/b-systems\\/entry$": { path: "/b-systems/entry", via: "crm-bsystems" },
  "\\/b-systems\\/entry": { path: "/b-systems/entry", via: "crm-bsystems" },
  /* the agent's board, matched loosely by the calendar and daily-report specs */
  "\\/b-systems\\/": { path: "/b-systems/crm", via: "crm-bsystems" },
};

export function landingFor(landing: RegExp): Landing {
  const found = LANDING_PATHS[landing.source];
  if (!found) throw new Error(`after-sign-in: no page known for landing ${landing}`);
  return found;
}

export function landingPath(landing: RegExp): string {
  return landingFor(landing).path;
}

/** Call right after clicking "Sign in": waits for the launcher, checks the
    tile that is the page's one way in is there, then opens `landing`'s page
    and waits for it. */
export async function afterSignIn(page: Page, landing: RegExp): Promise<void> {
  const { path, via } = landingFor(landing);
  await page.waitForURL(LAUNCHER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator(`[data-app="${via}"]`), `the ${via} tile is the way to ${path}`).toHaveCount(1);
  await page.goto(path);
  await page.waitForURL(landing);
}
