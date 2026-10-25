import { expect, type Page } from "@playwright/test";

/* ADR-090 — every account now lands on the app launcher (/apps) after signing
   in (founder: "Home after sign-in"). The specs were written against the old
   role landing, so after the Sign-in click they call this: it proves the
   launcher really was the landing, then opens the page the spec goes on to
   test and checks it is the one the spec expected.

   The table is STRICT on purpose: a landing it does not know throws, so a new
   spec cannot silently land somewhere it never asserted. */

export const LAUNCHER_URL = /\/apps(\?|$)/;

const LANDING_PATHS: Record<string, string> = {
  "\\/b-systems$": "/b-systems",
  "\\/b-systems\\?company=byteforce$": "/b-systems?company=byteforce",
  "\\/b-systems\\/crm$": "/b-systems/crm",
  "\\/b-systems\\/crm": "/b-systems/crm",
  "\\/b-systems\\/entry$": "/b-systems/entry",
  "\\/b-systems\\/entry": "/b-systems/entry",
  /* the agent's board, matched loosely by the calendar and daily-report specs */
  "\\/b-systems\\/": "/b-systems/crm",
};

export function landingPath(landing: RegExp): string {
  const path = LANDING_PATHS[landing.source];
  if (!path) throw new Error(`after-sign-in: no page known for landing ${landing}`);
  return path;
}

/** Call right after clicking "Sign in": waits for the launcher, then opens
    `landing`'s page and waits for it. */
export async function afterSignIn(page: Page, landing: RegExp): Promise<void> {
  await page.waitForURL(LAUNCHER_URL);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goto(landingPath(landing));
  await page.waitForURL(landing);
}
